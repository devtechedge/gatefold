import { describe, expect, it } from "vitest";
import {
  buyerCancellationAllowed,
  canTransition,
  confirmationAllowed,
  isHoldExpired,
} from "@/domain/reservation";
import {
  availabilityLabel,
  invariantHolds,
  remaining,
  validateRequestedLines,
} from "@/domain/inventory";
import { publishBlockers, salesState, unpublishBlocker } from "@/domain/event";
import { can } from "@/domain/permissions";
import { ticketPublicId, normalizeTicketCode, slugify } from "@/lib/ids";
import { ticketQrPayload, verifyQrPayload } from "@/domain/ticket";
import { parseReservationRef, reservationRef, verifyReservationRef } from "@/lib/access";
import { hashPassword, verifyPassword } from "@/lib/password";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-01T12:00:00.000Z");

describe("reservation state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("PENDING_HOLD", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_HOLD", "EXPIRED")).toBe(true);
    expect(canTransition("PENDING_HOLD", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "EXPIRED")).toBe(false);
    expect(canTransition("EXPIRED", "CONFIRMED")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("refuses confirmation once the hold deadline has passed", () => {
    expect(confirmationAllowed(new Date(NOW.getTime() + 1000), NOW)).toBe(true);
    expect(confirmationAllowed(NOW, NOW)).toBe(false);
    expect(isHoldExpired(new Date(NOW.getTime() - 1), NOW)).toBe(true);
  });

  it("closes buyer cancellation 24 hours before the first occurrence", () => {
    expect(buyerCancellationAllowed(new Date(NOW.getTime() + 25 * HOUR), NOW)).toBe(true);
    expect(buyerCancellationAllowed(new Date(NOW.getTime() + 24 * HOUR), NOW)).toBe(true);
    expect(buyerCancellationAllowed(new Date(NOW.getTime() + 23 * HOUR), NOW)).toBe(false);
  });
});

describe("inventory rules", () => {
  it("computes remaining and labels", () => {
    expect(remaining({ capacity: 10, held: 2, sold: 3 })).toBe(5);
    expect(remaining({ capacity: 2, held: 3, sold: 0 })).toBe(0);
    expect(availabilityLabel({ capacity: 10, held: 0, sold: 10 })).toBe("SOLD_OUT");
    expect(availabilityLabel({ capacity: 10, held: 0, sold: 5 })).toBe("LOW");
    expect(availabilityLabel({ capacity: 10, held: 0, sold: 1 })).toBe("AVAILABLE");
  });

  it("recognises a broken invariant", () => {
    expect(invariantHolds({ capacity: 5, held: 2, sold: 3 })).toBe(true);
    expect(invariantHolds({ capacity: 5, held: 3, sold: 3 })).toBe(false);
    expect(invariantHolds({ capacity: 5, held: -1, sold: 0 })).toBe(false);
  });

  it("rejects invalid requested lines", () => {
    expect(() => validateRequestedLines([])).toThrow();
    expect(() => validateRequestedLines([{ inventoryId: "a", quantity: 0 }])).toThrow();
    expect(() => validateRequestedLines([{ inventoryId: "a", quantity: 21 }])).toThrow();
    expect(() =>
      validateRequestedLines([
        { inventoryId: "a", quantity: 1 },
        { inventoryId: "a", quantity: 1 },
      ])
    ).toThrow();
    expect(() => validateRequestedLines([{ inventoryId: "a", quantity: 2 }])).not.toThrow();
  });
});

describe("sales windows", () => {
  const base = {
    salesStartAt: new Date(NOW.getTime() - HOUR),
    salesEndAt: new Date(NOW.getTime() + 2 * HOUR),
    occurrenceStartsAt: new Date(NOW.getTime() + 4 * HOUR),
  };

  it("is on sale inside the window", () => {
    expect(salesState(base, NOW)).toBe("ON_SALE");
  });

  it("is upcoming before the window and closed after it", () => {
    expect(salesState({ ...base, salesStartAt: new Date(NOW.getTime() + HOUR) }, NOW)).toBe("UPCOMING");
    expect(salesState({ ...base, salesEndAt: new Date(NOW.getTime() - 1) }, NOW)).toBe("CLOSED");
  });

  it("closes sales when the occurrence starts even without an end date", () => {
    expect(
      salesState({ salesStartAt: null, salesEndAt: null, occurrenceStartsAt: NOW }, NOW)
    ).toBe("CLOSED");
  });
});

describe("publishing rules", () => {
  it("requires a future occurrence and a sellable ticket type", () => {
    expect(
      publishBlockers(
        {
          occurrences: [{ startsAt: new Date(NOW.getTime() + HOUR), status: "SCHEDULED" }],
          ticketTypes: [{ status: "ACTIVE", capacity: 10 }],
        },
        NOW
      )
    ).toEqual([]);
    expect(
      publishBlockers(
        {
          occurrences: [{ startsAt: new Date(NOW.getTime() - HOUR), status: "SCHEDULED" }],
          ticketTypes: [{ status: "ACTIVE", capacity: 10 }],
        },
        NOW
      ).length
    ).toBe(1);
    expect(
      publishBlockers(
        {
          occurrences: [{ startsAt: new Date(NOW.getTime() + HOUR), status: "SCHEDULED" }],
          ticketTypes: [{ status: "ARCHIVED", capacity: 10 }],
        },
        NOW
      ).length
    ).toBe(1);
  });

  it("blocks unpublishing when holds or confirmed reservations exist", () => {
    expect(unpublishBlocker({ confirmedCount: 0, activeHoldCount: 0 })).toBeNull();
    expect(unpublishBlocker({ confirmedCount: 1, activeHoldCount: 0 })).toContain("Confirmed");
    expect(unpublishBlocker({ confirmedCount: 0, activeHoldCount: 1 })).toContain("holds");
  });
});

describe("role capabilities", () => {
  it("keeps pricing and team management away from check-in staff", () => {
    expect(can("CHECKIN", "checkin:perform")).toBe(true);
    expect(can("CHECKIN", "attendee:lookup")).toBe(true);
    expect(can("CHECKIN", "ticket:manage")).toBe(false);
    expect(can("CHECKIN", "event:manage")).toBe(false);
    expect(can("CHECKIN", "team:manage")).toBe(false);
    expect(can("MANAGER", "ticket:manage")).toBe(true);
    expect(can("MANAGER", "team:manage")).toBe(false);
    expect(can("OWNER", "team:manage")).toBe(true);
  });
});

describe("ticket identities", () => {
  it("mints unpredictable, formatted ticket ids", () => {
    const first = ticketPublicId();
    const second = ticketPublicId();
    expect(first).toMatch(/^GF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(first).not.toBe(second);
  });

  it("normalizes manual entry back to the canonical code", () => {
    const code = "GF-7K2M-9Q4X-3B8N-6T1V-5W0Z";
    expect(normalizeTicketCode(code.toLowerCase())).toBe(code);
    expect(normalizeTicketCode("gf7k2m9q4x3b8n6t1v5w0z")).toBe(code);
  });

  it("signs QR payloads and rejects tampering", () => {
    const code = ticketPublicId();
    const payload = ticketQrPayload(code);
    expect(verifyQrPayload(payload)).toEqual({ kind: "signed", publicId: code });
    const parts = payload.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}A`;
    expect(verifyQrPayload(tampered).kind).toBe("invalid");
    expect(verifyQrPayload(code)).toEqual({ kind: "unsigned", publicId: code });
  });
});

describe("reservation access references", () => {
  it("derives a stable reference and rejects another id or version", () => {
    const ref = reservationRef("reservation-1", 1);
    expect(parseReservationRef(ref)?.id).toBe("reservation-1");
    expect(verifyReservationRef(ref, "reservation-1", 1)).toBe(true);
    expect(verifyReservationRef(ref, "reservation-2", 1)).toBe(false);
    expect(verifyReservationRef(ref, "reservation-1", 2)).toBe(false);
  });
});

describe("utility ids", () => {
  it("produces stable slugs", () => {
    expect(slugify("  Night Market: Sessions!  ")).toBe("night-market-sessions");
    expect(slugify("Café / Thé")).toBe("cafe-the");
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("demo-password-1");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("demo-password-1");
    expect(await verifyPassword("demo-password-1", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });
});
