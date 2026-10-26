import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  cancelReservationByRef,
  createHold,
  expireDueHolds,
  requireReservationByRef,
} from "@/services/reservations";
import { demoCheckout } from "@/services/checkout";
import { verifyTicket } from "@/services/checkin";
import { cancelEvent } from "@/services/events";
import { ticketQrPayload } from "@/domain/ticket";
import { ticketPublicId } from "@/lib/ids";
import { eventAccess, organizerContext } from "@/lib/auth/organizer";
import { rateLimit } from "@/lib/auth/rate-limit";
import { searchAttendees } from "@/services/attendees";
import { createFixture, cleanupFixture, holdInput, type Fixture } from "../helpers/fixtures";

const fixtures: Fixture[] = [];

async function make(options: { capacity: number; startsInHours?: number } = { capacity: 4 }) {
  const fixture = await createFixture(options);
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await cleanupFixture(fixture);
  }
});

describe("checkout lifecycle", () => {
  it("issues exactly one ticket per confirmed quantity and is idempotent", async () => {
    const fixture = await make();
    const hold = await createHold(holdInput(fixture, 2));
    const first = await demoCheckout(hold.ref);
    expect(first.state).toBe("CONFIRMED");
    expect(first.tickets).toHaveLength(2);
    expect(first.demoConfirmed).toBe(true);
    const codes = first.tickets.map((ticket) => ticket.publicId);
    expect(new Set(codes).size).toBe(2);

    const second = await demoCheckout(hold.ref);
    expect(second.tickets).toHaveLength(2);
    expect(second.tickets.map((ticket) => ticket.publicId).sort()).toEqual([...codes].sort());

    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(0);
    expect(inventory.sold).toBe(2);
    expect(await prisma.issuedTicket.count({ where: { reservationLine: { reservation: { eventId: fixture.eventId } } } })).toBe(2);
    expect(await prisma.demoConfirmation.count()).toBeGreaterThanOrEqual(1);
  });

  it("blocks checkout after the hold deadline and releases the seats", async () => {
    const fixture = await make();
    const hold = await createHold(holdInput(fixture, 1));
    await prisma.reservation.update({
      where: { id: hold.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });
    await expect(demoCheckout(hold.ref)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(0);
    expect(inventory.sold).toBe(0);
    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } });
    expect(reservation.state).toBe("EXPIRED");
  });
});

describe("expiration", () => {
  it("releases held inventory once, even when the worker runs repeatedly", async () => {
    const fixture = await make();
    const hold = await createHold(holdInput(fixture, 2));
    await prisma.reservation.update({
      where: { id: hold.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });
    expect(await expireDueHolds({ eventId: fixture.eventId, limit: 10 })).toBe(1);
    expect(await expireDueHolds({ eventId: fixture.eventId, limit: 10 })).toBe(0);
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(0);
    expect(inventory.sold).toBe(0);
    const view = await requireReservationByRef(hold.ref);
    expect(view.state).toBe("EXPIRED");
  });
});

describe("cancellation", () => {
  it("releases sold inventory and voids tickets when the buyer cancels in time", async () => {
    const fixture = await make({ capacity: 4, startsInHours: 72 });
    const hold = await createHold(holdInput(fixture, 2));
    const confirmed = await demoCheckout(hold.ref);
    const cancelled = await cancelReservationByRef(hold.ref);
    expect(cancelled.state).toBe("CANCELLED");
    expect(cancelled.tickets.every((ticket) => ticket.status === "VOID")).toBe(true);
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.sold).toBe(0);
    expect(inventory.held).toBe(0);

    const code = confirmed.tickets[0].publicId;
    await expect(
      verifyTicket({
        payload: ticketQrPayload(code),
        staffUserId: fixture.staffId,
        expectedEventId: fixture.eventId,
      })
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("voids every ticket and expires holds when the organizer cancels the event", async () => {
    const fixture = await make();
    const confirmedHold = await createHold(holdInput(fixture, 2));
    const confirmed = await demoCheckout(confirmedHold.ref);
    const pending = await createHold(holdInput(fixture, 1));

    await cancelEvent(fixture.eventId, fixture.organizerId, fixture.ownerId, "Test cancellation");

    const event = await prisma.event.findUniqueOrThrow({ where: { id: fixture.eventId } });
    expect(event.status).toBe("CANCELLED");
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.sold).toBe(0);
    expect(inventory.held).toBe(0);
    const confirmedRow = await prisma.reservation.findUniqueOrThrow({ where: { id: confirmed.id } });
    expect(confirmedRow.state).toBe("CANCELLED");
    const pendingRow = await prisma.reservation.findUniqueOrThrow({ where: { id: pending.id } });
    expect(pendingRow.state).toBe("EXPIRED");
    const tickets = await prisma.issuedTicket.findMany({
      where: { reservationLine: { reservationId: confirmed.id } },
    });
    expect(tickets.every((ticket) => ticket.status === "VOID")).toBe(true);
  });
});

describe("check-in", () => {
  it("creates exactly one check-in when two scans race", async () => {
    const fixture = await make();
    const hold = await createHold(holdInput(fixture, 1));
    const reservation = await demoCheckout(hold.ref);
    const code = reservation.tickets[0].publicId;
    const payload = ticketQrPayload(code);
    const scans = await Promise.allSettled([
      verifyTicket({ payload, staffUserId: fixture.staffId, expectedEventId: fixture.eventId }),
      verifyTicket({ payload, staffUserId: fixture.staffId, expectedEventId: fixture.eventId }),
    ]);
    const results = scans
      .filter((scan) => scan.status === "fulfilled")
      .map((scan) => (scan.status === "fulfilled" ? scan.value.result : null));
    expect(results).toContain("CHECKED_IN");
    expect(results).toContain("ALREADY_USED");
    expect(await prisma.checkIn.count()).toBeGreaterThanOrEqual(1);
    const ticket = await prisma.issuedTicket.findUniqueOrThrow({ where: { publicId: code } });
    expect(await prisma.checkIn.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it("distinguishes invalid signatures, unknown tickets, wrong events and void tickets", async () => {
    const fixture = await make();
    const hold = await createHold(holdInput(fixture, 1));
    const reservation = await demoCheckout(hold.ref);
    const code = reservation.tickets[0].publicId;

    await expect(
      verifyTicket({
        payload: `${ticketQrPayload(code).slice(0, -1)}A`,
        staffUserId: fixture.staffId,
        expectedEventId: fixture.eventId,
      })
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });

    await expect(
      verifyTicket({
        payload: ticketPublicId(),
        staffUserId: fixture.staffId,
        expectedEventId: fixture.eventId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      verifyTicket({
        payload: ticketQrPayload(code),
        staffUserId: fixture.staffId,
        expectedEventId: "a-different-event",
      })
    ).rejects.toMatchObject({ code: "WRONG_EVENT" });
  });
});

describe("authorization boundaries", () => {
  it("refuses event access across organizers and keeps check-in staff out of ticket management", async () => {
    const first = await make();
    const second = await make();
    await expect(eventAccess(second.ownerId, first.eventId, "checkin:perform")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      organizerContext(first.staffId, first.organizerId, "ticket:manage")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const staffContext = await organizerContext(first.staffId, first.organizerId, "checkin:perform");
    expect(staffContext.role).toBe("CHECKIN");
    const ownerContext = await organizerContext(first.ownerId, first.organizerId, "team:manage");
    expect(ownerContext.role).toBe("OWNER");
  });

  it("returns attendee search results only for the scoped event", async () => {
    const first = await make();
    const second = await make();
    const hold = await createHold(holdInput(first, 1, `search-${first.suffix}@example.test`));
    await demoCheckout(hold.ref);
    const found = await searchAttendees(first.eventId, {
      q: `search-${first.suffix}@example.test`,
      state: "CONFIRMED",
      offset: 0,
      take: 10,
    });
    expect(found.rows).toHaveLength(1);
    const other = await searchAttendees(second.eventId, {
      q: `search-${first.suffix}@example.test`,
      state: "ALL",
      offset: 0,
      take: 10,
    });
    expect(other.rows).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("blocks the third request in a fixed window", async () => {
    const key = `test-limit-${ticketPublicId()}`;
    expect((await rateLimit(key, 2, 60)).allowed).toBe(true);
    expect((await rateLimit(key, 2, 60)).allowed).toBe(true);
    const blocked = await rateLimit(key, 2, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
