import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { ReservationCreateInput } from "@/validation/schemas";

const HOUR = 60 * 60 * 1000;

export interface Fixture {
  suffix: string;
  ownerId: string;
  staffId: string;
  organizerId: string;
  eventId: string;
  occurrenceId: string;
  ticketTypeId: string;
  inventoryId: string;
  capacity: number;
}

export async function createFixture(options: {
  capacity: number;
  startsInHours?: number;
  priceMinor?: number;
}): Promise<Fixture> {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  const owner = await prisma.user.create({
    data: {
      email: `owner-${suffix}@example.test`,
      displayName: "Test Owner",
      passwordHash: "not-used-in-tests",
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: `staff-${suffix}@example.test`,
      displayName: "Test Staff",
      passwordHash: "not-used-in-tests",
    },
  });
  const organizer = await prisma.organizer.create({
    data: { name: `Test Organizer ${suffix}`, slug: `test-organizer-${suffix}`, ownerId: owner.id },
  });
  await prisma.organizerMembership.createMany({
    data: [
      {
        organizerId: organizer.id,
        userId: owner.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
      {
        organizerId: organizer.id,
        userId: staff.id,
        role: "CHECKIN",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    ],
  });
  const venue = await prisma.venue.create({
    data: {
      organizerId: organizer.id,
      name: "Test Venue",
      address: "1 Test Street",
      timezone: "America/New_York",
    },
  });
  const startsAt = new Date(Date.now() + (options.startsInHours ?? 48) * HOUR);
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: venue.id,
      title: `Test Event ${suffix}`,
      slug: `test-event-${suffix}`,
      description: "Integration fixture event with a deterministic occurrence.",
      category: "Music",
      artwork: "ink",
      timezone: "America/New_York",
      status: "PUBLISHED",
      publishedAt: new Date(),
      occurrences: {
        create: {
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3 * HOUR),
          label: "Test occurrence",
        },
      },
    },
    include: { occurrences: true },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      label: "General",
      description: "Test ticket",
      priceMinor: options.priceMinor ?? 2500,
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
  });
  const inventory = await prisma.ticketInventory.create({
    data: {
      occurrenceId: event.occurrences[0].id,
      ticketTypeId: ticketType.id,
      capacity: options.capacity,
    },
  });
  await prisma.eventStaffAssignment.create({
    data: { eventId: event.id, userId: staff.id },
  });
  return {
    suffix,
    ownerId: owner.id,
    staffId: staff.id,
    organizerId: organizer.id,
    eventId: event.id,
    occurrenceId: event.occurrences[0].id,
    ticketTypeId: ticketType.id,
    inventoryId: inventory.id,
    capacity: options.capacity,
  };
}

export async function cleanupFixture(fixture: Fixture): Promise<void> {
  await prisma.reservation.deleteMany({ where: { organizerId: fixture.organizerId } }).catch(() => undefined);
  await prisma.event.deleteMany({ where: { organizerId: fixture.organizerId } }).catch(() => undefined);
  await prisma.organizer.delete({ where: { id: fixture.organizerId } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: fixture.ownerId } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: fixture.staffId } }).catch(() => undefined);
}

export function holdInput(
  fixture: Fixture,
  quantity = 1,
  email = `buyer-${randomUUID().slice(0, 8)}@example.test`
): ReservationCreateInput {
  return {
    eventId: fixture.eventId,
    occurrenceId: fixture.occurrenceId,
    items: [{ ticketTypeId: fixture.ticketTypeId, quantity }],
    buyer: { name: "Test Buyer", email, phone: "" },
  };
}
