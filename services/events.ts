import { randomUUID } from "node:crypto";
import { prisma, TX_OPTIONS } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { parseLocalDateTime } from "@/lib/dates";
import { randomBase32, slugify } from "@/lib/ids";
import { publishBlockers, unpublishBlocker } from "@/domain/event";
import type { EventCreateInput } from "@/validation/schemas";
import { releaseHeld, releaseSold } from "@/repositories/inventory";
import { recordAudit } from "./audit";

export async function assignedEventIds(userId: string, organizerId: string): Promise<string[]> {
  const rows = await prisma.eventStaffAssignment.findMany({
    where: { userId, event: { organizerId } },
    select: { eventId: true },
  });
  return rows.map((row) => row.eventId);
}

export async function eventStaff(eventId: string, organizerId: string) {
  const [members, assignments] = await Promise.all([
    prisma.organizerMembership.findMany({
      where: { organizerId, role: "CHECKIN", status: "ACTIVE" },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.eventStaffAssignment.findMany({ where: { eventId }, select: { userId: true } }),
  ]);
  const assigned = new Set(assignments.map((row) => row.userId));
  return members.map((member) => ({
    id: member.id,
    userId: member.userId,
    displayName: member.user.displayName,
    email: member.user.email,
    assigned: assigned.has(member.userId),
  }));
}

export async function setEventStaffAssignment(input: {
  eventId: string;
  organizerId: string;
  actorUserId: string;
  userId: string;
  assigned: boolean;
}) {
  const [event, member] = await Promise.all([
    prisma.event.findUnique({ where: { id: input.eventId }, select: { organizerId: true, title: true } }),
    prisma.organizerMembership.findUnique({
      where: { organizerId_userId: { organizerId: input.organizerId, userId: input.userId } },
      select: { role: true, status: true },
    }),
  ]);
  if (!event || event.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Event not found.", 404);
  }
  if (!member || member.role !== "CHECKIN" || member.status !== "ACTIVE") {
    throw new HttpError("VALIDATION_ERROR", "Choose an active check-in staff member.", 400);
  }
  await prisma.$transaction(async (tx) => {
    if (input.assigned) {
      await tx.eventStaffAssignment.upsert({
        where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
        update: {},
        create: { eventId: input.eventId, userId: input.userId },
      });
    } else {
      await tx.eventStaffAssignment.deleteMany({
        where: { eventId: input.eventId, userId: input.userId },
      });
    }
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: input.assigned ? "event.staff_assigned" : "event.staff_unassigned",
      targetType: "event",
      targetId: input.eventId,
      metadata: { userId: input.userId },
    });
  });
}

export async function uniqueOrganizerSlug(base: string): Promise<string> {
  const root = slugify(base) || "organizer";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await prisma.organizer.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${root}-${randomUUID().slice(0, 8)}`;
}

export async function createEvent(input: EventCreateInput, organizerId: string, actorUserId: string) {
  const timezone = input.timezone;
  const occurrences = input.occurrences.map((occurrence) => {
    const startsAt = parseLocalDateTime(occurrence.startsAtLocal, timezone);
    const endsAt = parseLocalDateTime(occurrence.endsAtLocal, timezone);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new HttpError("VALIDATION_ERROR", "Each occurrence must end after it starts.", 400);
    }
    return { startsAt, endsAt, label: occurrence.label ?? "" };
  });

  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.create({
      data: {
        organizerId,
        name: input.venueName,
        address: input.venueAddress,
        timezone,
        accessibility: input.accessibility ?? "",
      },
    });
    const base = slugify(input.title) || "event";
    let slug = base;
    if (await tx.event.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${base}-${randomBase32(5).toLowerCase()}`;
    }
    const event = await tx.event.create({
      data: {
        organizerId,
        venueId: venue.id,
        title: input.title,
        slug,
        description: input.description,
        category: input.category,
        artwork: input.artwork,
        timezone,
        status: "DRAFT",
        occurrences: { create: occurrences },
      },
    });
    await recordAudit(tx, {
      organizerId,
      actorUserId,
      action: "event.created",
      targetType: "event",
      targetId: event.id,
      metadata: { title: event.title },
    });
    return { id: event.id, slug: event.slug };
  });
}

export async function updateEvent(
  eventId: string,
  organizerId: string,
  actorUserId: string,
  input: {
    title: string;
    description: string;
    category: string;
    artwork: string;
    accessibility: string;
  }
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: true },
  });
  if (!event || event.organizerId !== organizerId) {
    throw new HttpError("NOT_FOUND", "Event not found.", 404);
  }
  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        artwork: input.artwork,
      },
    });
    await tx.venue.update({
      where: { id: event.venueId },
      data: { accessibility: input.accessibility ?? "" },
    });
    await recordAudit(tx, {
      organizerId,
      actorUserId,
      action: "event.updated",
      targetType: "event",
      targetId: eventId,
    });
  });
}

export async function publishEvent(eventId: string, organizerId: string, actorUserId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      occurrences: true,
      ticketTypes: { include: { inventories: true } },
    },
  });
  if (!event || event.organizerId !== organizerId) {
    throw new HttpError("NOT_FOUND", "Event not found.", 404);
  }
  if (event.status === "CANCELLED") {
    throw new HttpError("INVALID_STATE", "A cancelled event cannot be published.", 409);
  }
  const blockers = publishBlockers(
    {
      occurrences: event.occurrences,
      ticketTypes: event.ticketTypes.map((type) => ({
        status: type.status,
        capacity: type.inventories.reduce((sum, row) => sum + row.capacity, 0),
      })),
    },
    new Date()
  );
  if (blockers.length > 0) {
    throw new HttpError("INVALID_STATE", blockers.join(" "), 409);
  }
  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { status: "PUBLISHED", publishedAt: event.publishedAt ?? new Date() },
    });
    await recordAudit(tx, {
      organizerId,
      actorUserId,
      action: "event.published",
      targetType: "event",
      targetId: eventId,
    });
  });
}

export async function unpublishEvent(eventId: string, organizerId: string, actorUserId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.organizerId !== organizerId) {
    throw new HttpError("NOT_FOUND", "Event not found.", 404);
  }
  if (event.status !== "PUBLISHED") {
    throw new HttpError("INVALID_STATE", "Only published events can be unpublished.", 409);
  }
  const [confirmedCount, activeHoldCount] = await Promise.all([
    prisma.reservation.count({ where: { eventId, state: "CONFIRMED" } }),
    prisma.reservation.count({
      where: { eventId, state: "PENDING_HOLD", holdExpiresAt: { gt: new Date() } },
    }),
  ]);
  const blocker = unpublishBlocker({ confirmedCount, activeHoldCount });
  if (blocker) throw new HttpError("INVALID_STATE", blocker, 409);
  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: { status: "DRAFT", publishedAt: null } });
    await recordAudit(tx, {
      organizerId,
      actorUserId,
      action: "event.unpublished",
      targetType: "event",
      targetId: eventId,
    });
  });
}

export async function cancelEvent(
  eventId: string,
  organizerId: string,
  actorUserId: string,
  reason: string
) {
  const outcome = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM event WHERE id = ${eventId} AND "organizerId" = ${organizerId} FOR UPDATE
      `;
      if (rows.length === 0) return "missing";
      if (rows[0].status === "CANCELLED") return "unchanged";

      const reservations = await tx.reservation.findMany({
        where: { eventId, state: { in: ["PENDING_HOLD", "CONFIRMED"] } },
        include: { lines: { include: { tickets: true } } },
        orderBy: { id: "asc" },
      });
      for (const reservation of reservations) {
        for (const line of reservation.lines) {
          const inventory = await tx.ticketInventory.findFirst({
            where: { occurrenceId: line.occurrenceId, ticketTypeId: line.ticketTypeId },
            select: { id: true },
          });
          if (!inventory) continue;
          if (reservation.state === "PENDING_HOLD") {
            await releaseHeld(tx, inventory.id, line.quantity);
          } else {
            await releaseSold(tx, inventory.id, line.quantity);
          }
        }
        if (reservation.state === "CONFIRMED") {
          await tx.issuedTicket.updateMany({
            where: {
              reservationLineId: { in: reservation.lines.map((line) => line.id) },
              status: "VALID",
            },
            data: {
              status: "VOID",
              revokedAt: new Date(),
              revocationReason: "Event cancelled by organizer",
            },
          });
          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              state: "CANCELLED",
              cancelledAt: new Date(),
              cancellationReason: "Event cancelled by organizer",
            },
          });
        } else {
          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              state: "EXPIRED",
              expiredAt: new Date(),
              cancellationReason: "Event cancelled by organizer",
            },
          });
        }
      }
      await tx.eventOccurrence.updateMany({
        where: { eventId },
        data: { status: "CANCELLED" },
      });
      await tx.event.update({
        where: { id: eventId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationPolicy: reason.slice(0, 1000) || "All demo tickets are void. No payment was collected.",
        },
      });
      await recordAudit(tx, {
        organizerId,
        actorUserId,
        action: "event.cancelled",
        targetType: "event",
        targetId: eventId,
        metadata: { affectedReservations: reservations.length, reason: reason.slice(0, 300) },
      });
      return "cancelled";
    },
    { ...TX_OPTIONS, timeout: 40_000 }
  );
  if (outcome === "missing") throw new HttpError("NOT_FOUND", "Event not found.", 404);
}

export async function addTicketType(input: {
  eventId: string;
  organizerId: string;
  actorUserId: string;
  label: string;
  description: string;
  price: string;
  capacity: number;
  salesStartLocal?: string;
  salesEndLocal?: string;
}) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: { occurrences: true },
  });
  if (!event || event.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Event not found.", 404);
  }
  if (event.status === "CANCELLED") {
    throw new HttpError("INVALID_STATE", "A cancelled event cannot take new ticket types.", 409);
  }
  if (event.occurrences.length === 0) {
    throw new HttpError("INVALID_STATE", "Add an occurrence before adding tickets.", 409);
  }
  const priceMinor = Math.round(Number(input.price) * 100);
  if (!Number.isFinite(priceMinor) || priceMinor < 0 || priceMinor > 1_000_000) {
    throw new HttpError("VALIDATION_ERROR", "Enter a valid price.", 400);
  }
  const salesStartAt = input.salesStartLocal
    ? parseLocalDateTime(input.salesStartLocal, event.timezone)
    : null;
  const salesEndAt = input.salesEndLocal
    ? parseLocalDateTime(input.salesEndLocal, event.timezone)
    : null;
  if (salesStartAt && salesEndAt && salesEndAt <= salesStartAt) {
    throw new HttpError("VALIDATION_ERROR", "Sales must end after they start.", 400);
  }
  await prisma.$transaction(async (tx) => {
    const type = await tx.ticketType.create({
      data: {
        eventId: event.id,
        label: input.label,
        description: input.description,
        priceMinor,
        salesStartAt,
        salesEndAt,
        status: "ACTIVE",
      },
    });
    await tx.ticketInventory.createMany({
      data: event.occurrences.map((occurrence) => ({
        occurrenceId: occurrence.id,
        ticketTypeId: type.id,
        capacity: input.capacity,
      })),
    });
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "ticket_type.created",
      targetType: "ticket_type",
      targetId: type.id,
      metadata: { label: input.label, priceMinor, capacity: input.capacity },
    });
  });
}

export async function updateTicketType(input: {
  ticketTypeId: string;
  organizerId: string;
  actorUserId: string;
  label: string;
  description: string;
  price: string;
  salesStartLocal?: string;
  salesEndLocal?: string;
}) {
  const type = await prisma.ticketType.findUnique({
    where: { id: input.ticketTypeId },
    include: { event: true },
  });
  if (!type || type.event.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Ticket type not found.", 404);
  }
  const priceMinor = Math.round(Number(input.price) * 100);
  if (!Number.isFinite(priceMinor) || priceMinor < 0 || priceMinor > 1_000_000) {
    throw new HttpError("VALIDATION_ERROR", "Enter a valid price.", 400);
  }
  const salesStartAt = input.salesStartLocal
    ? parseLocalDateTime(input.salesStartLocal, type.event.timezone)
    : null;
  const salesEndAt = input.salesEndLocal
    ? parseLocalDateTime(input.salesEndLocal, type.event.timezone)
    : null;
  if (salesStartAt && salesEndAt && salesEndAt <= salesStartAt) {
    throw new HttpError("VALIDATION_ERROR", "Sales must end after they start.", 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.ticketType.update({
      where: { id: type.id },
      data: {
        label: input.label,
        description: input.description,
        priceMinor,
        salesStartAt,
        salesEndAt,
      },
    });
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "ticket_type.updated",
      targetType: "ticket_type",
      targetId: type.id,
    });
  });
}

export async function setTicketTypeStatus(input: {
  ticketTypeId: string;
  organizerId: string;
  actorUserId: string;
  status: "ACTIVE" | "ARCHIVED";
}) {
  const type = await prisma.ticketType.findUnique({
    where: { id: input.ticketTypeId },
    include: { event: true },
  });
  if (!type || type.event.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Ticket type not found.", 404);
  }
  await prisma.$transaction(async (tx) => {
    await tx.ticketType.update({ where: { id: type.id }, data: { status: input.status } });
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: input.status === "ARCHIVED" ? "ticket_type.archived" : "ticket_type.reactivated",
      targetType: "ticket_type",
      targetId: type.id,
    });
  });
}

export async function setTicketTypeVisibility(input: {
  ticketTypeId: string;
  organizerId: string;
  actorUserId: string;
  visibility: "PUBLIC" | "HIDDEN";
}) {
  const type = await prisma.ticketType.findUnique({
    where: { id: input.ticketTypeId },
    include: { event: true },
  });
  if (!type || type.event.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Ticket type not found.", 404);
  }
  await prisma.$transaction(async (tx) => {
    await tx.ticketType.update({
      where: { id: type.id },
      data: { visibility: input.visibility },
    });
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action:
        input.visibility === "HIDDEN"
          ? "ticket_type.hidden"
          : "ticket_type.shown",
      targetType: "ticket_type",
      targetId: type.id,
    });
  });
}

export async function updateCapacity(input: {
  inventoryId: string;
  organizerId: string;
  actorUserId: string;
  capacity: number;
}) {
  const inventory = await prisma.ticketInventory.findUnique({
    where: { id: input.inventoryId },
    include: {
      occurrence: { include: { event: true } },
      ticketType: true,
    },
  });
  if (!inventory || inventory.occurrence.event.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Inventory row not found.", 404);
  }
  if (input.capacity < inventory.held + inventory.sold) {
    throw new HttpError(
      "CONFLICT",
      `Capacity cannot drop below the ${inventory.held + inventory.sold} tickets already held or sold.`,
      409
    );
  }
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      UPDATE ticket_inventory
      SET capacity = ${input.capacity}, version = version + 1, "updatedAt" = now()
      WHERE id = ${input.inventoryId} AND ${input.capacity} >= held + sold
      RETURNING id
    `;
    if (rows.length === 0) {
      throw new HttpError("CONFLICT", "Capacity changed concurrently. Reload and try again.", 409);
    }
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "inventory.capacity_updated",
      targetType: "ticket_inventory",
      targetId: input.inventoryId,
      metadata: { capacity: input.capacity },
    });
  });
}
