import { describe, expect, it } from "vitest";
import {
  eventCreateSchema,
  reservationCreateSchema,
  ticketTypeCreateSchema,
  verifySchema,
  inviteSchema,
  eventListSchema,
} from "@/validation/schemas";

describe("event creation schema", () => {
  it("accepts a complete event", () => {
    const result = eventCreateSchema.safeParse({
      title: "Night Market Sessions",
      description: "Two evenings of low light and long form listening.",
      category: "Music",
      artwork: "vermilion",
      timezone: "America/New_York",
      venueName: "The Paper Hall",
      venueAddress: "14 Lantern Lane, Brooklyn",
      accessibility: "Step-free entrance.",
      occurrences: [
        {
          startsAtLocal: "2026-11-10T19:30",
          endsAtLocal: "2026-11-10T23:00",
          label: "Friday",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an event with no occurrences and a bad timezone", () => {
    const base = {
      title: "Test event",
      description: "A description long enough to pass validation.",
      category: "Music",
      artwork: "ink",
      timezone: "Mars/Olympus",
      venueName: "A room",
      venueAddress: "1 Street",
      accessibility: "",
      occurrences: [],
    };
    const result = eventCreateSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects an occurrence that ends before it starts", () => {
    const result = eventCreateSchema.safeParse({
      title: "Test event",
      description: "A description long enough to pass validation.",
      category: "Music",
      artwork: "ink",
      timezone: "UTC",
      venueName: "A room",
      venueAddress: "1 Street",
      occurrences: [
        { startsAtLocal: "2026-11-10T23:00", endsAtLocal: "2026-11-10T19:00", label: "" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("reservation schema", () => {
  const base = {
    eventId: "event-1",
    occurrenceId: "occurrence-1",
    items: [{ ticketTypeId: "ticket-1", quantity: 2 }],
    buyer: { name: "Ari Voss", email: "ari@example.test", phone: "" },
  };

  it("normalizes the buyer email", () => {
    const result = reservationCreateSchema.safeParse({
      ...base,
      buyer: { ...base.buyer, email: "ARI@Example.TEST" },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.buyer.email).toBe("ari@example.test");
  });

  it("rejects zero quantity and duplicate-looking empty lines", () => {
    expect(
      reservationCreateSchema.safeParse({ ...base, items: [{ ticketTypeId: "t", quantity: 0 }] }).success
    ).toBe(false);
    expect(reservationCreateSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
});

describe("ticket type schema", () => {
  it("accepts a price with two decimals and rejects a negative one", () => {
    const good = ticketTypeCreateSchema.safeParse({
      label: "General",
      description: "",
      price: "24.50",
      capacity: "40",
    });
    expect(good.success).toBe(true);
    if (good.success) expect(good.data.capacity).toBe(40);
    const bad = ticketTypeCreateSchema.safeParse({
      label: "General",
      description: "",
      price: "-4",
      capacity: "40",
    });
    expect(bad.success).toBe(false);
  });
});

describe("verification schema", () => {
  it("defaults to a scan and accepts a manual method", () => {
    const scan = verifySchema.safeParse({ payload: "GF-1234", eventId: "e1", gateLabel: "Door" });
    expect(scan.success).toBe(true);
    if (scan.success) expect(scan.data.method).toBe("SCAN");
    const manual = verifySchema.safeParse({
      payload: "GF-1234",
      eventId: "e1",
      method: "MANUAL",
    });
    expect(manual.success).toBe(true);
    if (manual.success) expect(manual.data.method).toBe("MANUAL");
  });
});

describe("invite schema", () => {
  it("only allows manager and check-in roles", () => {
    expect(inviteSchema.safeParse({ email: "new@example.test", role: "MANAGER" }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "new@example.test", role: "OWNER" }).success).toBe(false);
  });
});

describe("catalogue schema", () => {
  it("falls back safely when filters are missing", () => {
    const result = eventListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe("ALL");
      expect(result.data.availability).toBe("ALL");
      expect(result.data.take).toBe(12);
    }
  });
});
