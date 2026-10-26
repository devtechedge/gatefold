import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createHold } from "@/services/reservations";
import { createFixture, cleanupFixture, holdInput, type Fixture } from "../helpers/fixtures";

const fixtures: Fixture[] = [];

async function make(options: { capacity: number }) {
  const fixture = await createFixture(options);
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await cleanupFixture(fixture);
  }
});

describe("inventory under contention", () => {
  it("allows exactly one winner when twenty buyers race for the final ticket", async () => {
    const fixture = await make({ capacity: 1 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        createHold(holdInput(fixture, 1, `race-${index}-${fixture.suffix}@example.test`))
      )
    );
    const winners = attempts.filter((result) => result.status === "fulfilled");
    const losers = attempts.filter((result) => result.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);
    for (const loser of losers) {
      if (loser.status === "rejected") {
        expect((loser.reason as { code?: string }).code).toBe("SOLD_OUT");
      }
    }
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(1);
    expect(inventory.sold).toBe(0);
    expect(inventory.held + inventory.sold).toBeLessThanOrEqual(inventory.capacity);
    const reservations = await prisma.reservation.count({ where: { eventId: fixture.eventId } });
    expect(reservations).toBe(1);
  });

  it("never commits a partial reservation when two orders exceed capacity", async () => {
    const fixture = await make({ capacity: 3 });
    const attempts = await Promise.allSettled([
      createHold(holdInput(fixture, 2, `bulk-a-${fixture.suffix}@example.test`)),
      createHold(holdInput(fixture, 2, `bulk-b-${fixture.suffix}@example.test`)),
    ]);
    const winners = attempts.filter((result) => result.status === "fulfilled");
    expect(winners).toHaveLength(1);
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(2);
    expect(inventory.sold).toBe(0);
    expect(inventory.held + inventory.sold).toBeLessThanOrEqual(3);
  });

  it("honours an idempotency key and rejects key reuse with a different payload", async () => {
    const fixture = await make({ capacity: 5 });
    const key = `idem-${fixture.suffix}`;
    const input = holdInput(fixture, 1, `idem-${fixture.suffix}@example.test`);
    const first = await createHold(input, key);
    const second = await createHold(input, key);
    expect(second.ref).toBe(first.ref);
    expect(second.id).toBe(first.id);
    expect(await prisma.reservation.count({ where: { eventId: fixture.eventId } })).toBe(1);
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(1);

    const conflicting = holdInput(fixture, 2, `idem-${fixture.suffix}@example.test`);
    await expect(createHold(conflicting, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const after = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(after.held).toBe(1);
  });

  it("rejects holds against an event that is no longer published", async () => {
    const fixture = await make({ capacity: 5 });
    await prisma.event.update({ where: { id: fixture.eventId }, data: { status: "DRAFT" } });
    await expect(createHold(holdInput(fixture, 1))).rejects.toMatchObject({ code: "INVALID_STATE" });
    const inventory = await prisma.ticketInventory.findUniqueOrThrow({
      where: { id: fixture.inventoryId },
    });
    expect(inventory.held).toBe(0);
  });
});
