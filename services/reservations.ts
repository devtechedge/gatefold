import { randomUUID } from "node:crypto";
import { prisma, TX_OPTIONS } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { reservationRef, parseReservationRef, verifyReservationRef } from "@/lib/access";
import { sha256 } from "@/lib/ids";
import { buyerCancellationAllowed, isHoldExpired } from "@/domain/reservation";
import { canSell } from "@/domain/event";
import { HOLD_DURATION_MS, type ReservationState } from "@/domain/types";
import { holdInventory, releaseHeld, releaseSold } from "@/repositories/inventory";
import { recordAudit } from "./audit";
import type { ReservationCreateInput } from "@/validation/schemas";

export interface ReservationLineView {
  id: string;
  ticketTypeId: string;
  label: string;
  quantity: number;
  unitPriceMinor: number;
  startsAt: string;
  endsAt: string;
}

export interface ReservationTicketView {
  publicId: string;
  attendeeName: string;
  status: string;
  label: string;
  startsAt: string;
}

export interface ReservationView {
  id: string;
  ref: string;
  state: ReservationState;
  buyerName: string;
  buyerEmail: string;
  currency: string;
  totalMinor: number;
  holdExpiresAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    slug: string;
    timezone: string;
    artwork: string;
    venueName: string;
    venueAddress: string;
    organizerName: string;
    status: string;
  };
  lines: ReservationLineView[];
  tickets: ReservationTicketView[];
  demoConfirmed: boolean;
}

export interface HoldResult {
  id: string;
  ref: string;
  holdExpiresAt: string;
  totalMinor: number;
  currency: string;
  state: ReservationState;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function toView(reservation: {
  id: string;
  accessVersion: number;
  state: string;
  buyerName: string;
  buyerEmail: string;
  currency: string;
  totalMinor: number;
  holdExpiresAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  event: {
    id: string;
    title: string;
    slug: string;
    timezone: string;
    artwork: string;
    status: string;
    organizer: { name: string };
    venue: { name: string; address: string };
  };
  lines: {
    id: string;
    ticketTypeId: string;
    labelSnapshot: string;
    quantity: number;
    unitPriceMinor: number;
    occurrence: { startsAt: Date; endsAt: Date };
    tickets: { publicId: string; attendeeName: string; status: string }[];
  }[];
  demoConfirmation: { id: string } | null;
}): ReservationView {
  return {
    id: reservation.id,
    ref: reservationRef(reservation.id, reservation.accessVersion),
    state: reservation.state as ReservationState,
    buyerName: reservation.buyerName,
    buyerEmail: reservation.buyerEmail,
    currency: reservation.currency,
    totalMinor: reservation.totalMinor,
    holdExpiresAt: reservation.holdExpiresAt.toISOString(),
    confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
    cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
    expiredAt: reservation.expiredAt?.toISOString() ?? null,
    createdAt: reservation.createdAt.toISOString(),
    event: {
      id: reservation.event.id,
      title: reservation.event.title,
      slug: reservation.event.slug,
      timezone: reservation.event.timezone,
      artwork: reservation.event.artwork,
      venueName: reservation.event.venue.name,
      venueAddress: reservation.event.venue.address,
      organizerName: reservation.event.organizer.name,
      status: reservation.event.status,
    },
    lines: reservation.lines.map((line) => ({
      id: line.id,
      ticketTypeId: line.ticketTypeId,
      label: line.labelSnapshot,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      startsAt: line.occurrence.startsAt.toISOString(),
      endsAt: line.occurrence.endsAt.toISOString(),
    })),
    tickets: reservation.lines.flatMap((line) =>
      line.tickets.map((ticket) => ({
        publicId: ticket.publicId,
        attendeeName: ticket.attendeeName,
        status: ticket.status,
        label: line.labelSnapshot,
        startsAt: line.occurrence.startsAt.toISOString(),
      }))
    ),
    demoConfirmed: Boolean(reservation.demoConfirmation),
  };
}

const RESERVATION_INCLUDE = {
  event: {
    include: {
      organizer: { select: { name: true } },
      venue: { select: { name: true, address: true } },
    },
  },
  lines: {
    include: {
      occurrence: { select: { startsAt: true, endsAt: true } },
      tickets: { select: { publicId: true, attendeeName: true, status: true } },
    },
  },
  demoConfirmation: { select: { id: true } },
} as const;

export async function findReservationByRef(ref: string): Promise<ReservationView | null> {
  const parsed = parseReservationRef(ref);
  if (!parsed) return null;
  let reservation = await prisma.reservation.findUnique({
    where: { id: parsed.id },
    include: RESERVATION_INCLUDE,
  });
  if (!reservation) return null;
  if (!verifyReservationRef(ref, reservation.id, reservation.accessVersion)) return null;
  if (reservation.state === "PENDING_HOLD" && isHoldExpired(reservation.holdExpiresAt, new Date())) {
    await expireOne(reservation.id);
    reservation = await prisma.reservation.findUnique({
      where: { id: parsed.id },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) return null;
  }
  return toView(reservation);
}

export async function requireReservationByRef(ref: string): Promise<ReservationView> {
  const reservation = await findReservationByRef(ref);
  if (!reservation) throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  return reservation;
}

export async function createHold(
  input: ReservationCreateInput,
  idempotencyKey?: string
): Promise<HoldResult> {
  const now = new Date();
  await expireDueHolds({ eventId: input.eventId, limit: 20 });

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      occurrences: { where: { id: input.occurrenceId } },
      ticketTypes: { where: { id: { in: input.items.map((i) => i.ticketTypeId) } } },
    },
  });
  if (!event) throw new HttpError("NOT_FOUND", "Event not found.", 404);
  if (event.status !== "PUBLISHED") {
    throw new HttpError("INVALID_STATE", "This event is not on sale.", 409);
  }
  const occurrence = event.occurrences[0];
  if (!occurrence || occurrence.status !== "SCHEDULED") {
    throw new HttpError("INVALID_STATE", "That date is not available.", 409);
  }
  if (occurrence.startsAt.getTime() <= now.getTime()) {
    throw new HttpError("INVALID_STATE", "That date has already started.", 409);
  }

  const ticketTypes = new Map(event.ticketTypes.map((type) => [type.id, type]));
  for (const item of input.items) {
    const type = ticketTypes.get(item.ticketTypeId);
    if (!type || type.visibility !== "PUBLIC" || type.status !== "ACTIVE") {
      throw new HttpError("NOT_FOUND", "A selected ticket type is not available.", 404);
    }
    if (
      !canSell(
        {
          salesStartAt: type.salesStartAt,
          salesEndAt: type.salesEndAt,
          occurrenceStartsAt: occurrence.startsAt,
        },
        now
      )
    ) {
      throw new HttpError("INVALID_STATE", `${type.label} is not on sale right now.`, 409);
    }
  }

  const inventories = await prisma.ticketInventory.findMany({
    where: {
      occurrenceId: occurrence.id,
      ticketTypeId: { in: input.items.map((i) => i.ticketTypeId) },
    },
  });
  const inventoryByType = new Map(inventories.map((row) => [row.ticketTypeId, row]));
  const prepared = input.items
    .map((item) => {
      const type = ticketTypes.get(item.ticketTypeId)!;
      const inventory = inventoryByType.get(item.ticketTypeId);
      if (!inventory) throw new HttpError("CONFLICT", "Inventory is not configured for that ticket.", 409);
      return {
        inventoryId: inventory.id,
        ticketTypeId: type.id,
        occurrenceId: occurrence.id,
        quantity: item.quantity,
        unitPriceMinor: type.priceMinor,
        labelSnapshot: type.label,
      };
    })
    .sort((a, b) => a.inventoryId.localeCompare(b.inventoryId));

  const totalMinor = prepared.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const currency = ticketTypes.get(prepared[0].ticketTypeId)?.currency ?? "USD";
  const scope = `reservation:${event.id}`;
  const requestHash = sha256(
    JSON.stringify({
      eventId: event.id,
      occurrenceId: occurrence.id,
      buyer: input.buyer,
      items: prepared.map((line) => ({
        ticketTypeId: line.ticketTypeId,
        quantity: line.quantity,
      })),
    })
  );

  const normalizedKey = idempotencyKey?.trim().slice(0, 120);

  if (normalizedKey) {
    const existing = await prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key: normalizedKey } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new HttpError(
          "IDEMPOTENCY_CONFLICT",
          "That idempotency key was already used with a different request.",
          409
        );
      }
      if (existing.status === "COMPLETED" && existing.responseJson) {
        return JSON.parse(existing.responseJson) as HoldResult;
      }
      throw new HttpError("CONFLICT", "That request is still processing. Retry shortly.", 409);
    }
  }

  const reservationId = randomUUID();
  const ref = reservationRef(reservationId, 1);
  const holdExpiresAt = new Date(now.getTime() + HOLD_DURATION_MS);
  const response: HoldResult = {
    id: reservationId,
    ref,
    holdExpiresAt: holdExpiresAt.toISOString(),
    totalMinor,
    currency,
    state: "PENDING_HOLD",
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        const lockedEvent = await tx.$queryRaw<{ status: string }[]>`
          SELECT status FROM event WHERE id = ${event.id} FOR SHARE
        `;
        if (lockedEvent[0]?.status !== "PUBLISHED") {
          throw new HttpError("INVALID_STATE", "This event is no longer on sale.", 409);
        }
        if (normalizedKey) {
          await tx.idempotencyRecord.create({
            data: {
              id: randomUUID(),
              scope,
              key: normalizedKey,
              requestHash,
              status: "PROCESSING",
            },
          });
        }
        for (const line of prepared) {
          const held = await holdInventory(tx, line.inventoryId, line.quantity);
          if (!held) {
            throw new HttpError(
              "SOLD_OUT",
              "Those tickets just sold out. Choose a different quantity or ticket type.",
              409
            );
          }
        }
        await tx.reservation.create({
          data: {
            id: reservationId,
            organizerId: event.organizerId,
            eventId: event.id,
            state: "PENDING_HOLD",
            buyerName: input.buyer.name,
            buyerEmail: input.buyer.email,
            buyerPhone: input.buyer.phone ?? "",
            currency,
            totalMinor,
            holdExpiresAt,
            lines: {
              create: prepared.map((line) => ({
                ticketTypeId: line.ticketTypeId,
                occurrenceId: line.occurrenceId,
                quantity: line.quantity,
                unitPriceMinor: line.unitPriceMinor,
                labelSnapshot: line.labelSnapshot,
              })),
            },
          },
        });
        if (normalizedKey) {
          await tx.idempotencyRecord.update({
            where: { scope_key: { scope, key: normalizedKey } },
            data: { status: "COMPLETED", responseJson: JSON.stringify(response) },
          });
        }
      },
      TX_OPTIONS
    );
    return response;
  } catch (error) {
    if (isUniqueViolation(error) && normalizedKey) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key: normalizedKey } },
      });
      if (existing?.status === "COMPLETED" && existing.requestHash === requestHash && existing.responseJson) {
        return JSON.parse(existing.responseJson) as HoldResult;
      }
      if (existing && existing.requestHash !== requestHash) {
        throw new HttpError(
          "IDEMPOTENCY_CONFLICT",
          "That idempotency key was already used with a different request.",
          409
        );
      }
      throw new HttpError("CONFLICT", "That request is still processing. Retry shortly.", 409);
    }
    throw error;
  }
}

export async function expireDueHolds(options: { limit?: number; eventId?: string } = {}): Promise<number> {
  const due = await prisma.reservation.findMany({
    where: {
      state: "PENDING_HOLD",
      holdExpiresAt: { lte: new Date() },
      ...(options.eventId ? { eventId: options.eventId } : {}),
    },
    take: options.limit ?? 25,
    select: { id: true },
    orderBy: { holdExpiresAt: "asc" },
  });
  let expired = 0;
  for (const row of due) {
    if (await expireOne(row.id)) expired += 1;
  }
  return expired;
}

export async function expireOne(reservationId: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; organizerId: string }[]>`
        SELECT id, "organizerId" FROM reservation
        WHERE id = ${reservationId} AND state = 'PENDING_HOLD' AND "holdExpiresAt" <= now()
        FOR UPDATE
      `;
      if (rows.length === 0) return false;
      const lines = await tx.reservationLine.findMany({
        where: { reservationId },
        select: { ticketTypeId: true, occurrenceId: true, quantity: true },
      });
      for (const line of lines) {
        const inventory = await tx.ticketInventory.findFirst({
          where: { occurrenceId: line.occurrenceId, ticketTypeId: line.ticketTypeId },
          select: { id: true },
        });
        if (inventory) await releaseHeld(tx, inventory.id, line.quantity);
      }
      await tx.reservation.update({
        where: { id: reservationId },
        data: { state: "EXPIRED", expiredAt: new Date() },
      });
      await recordAudit(tx, {
        organizerId: rows[0].organizerId,
        action: "reservation.expired",
        targetType: "reservation",
        targetId: reservationId,
      });
      return true;
    },
    TX_OPTIONS
  );
}

export async function cancelReservationByRef(
  ref: string,
  reason = "Cancelled by buyer"
): Promise<ReservationView> {
  const parsed = parseReservationRef(ref);
  if (!parsed) throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  const existing = await prisma.reservation.findUnique({
    where: { id: parsed.id },
    select: { id: true, accessVersion: true },
  });
  if (!existing || !verifyReservationRef(ref, existing.id, existing.accessVersion)) {
    throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  }
  await expireOne(existing.id);

  const outcome = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ state: string; organizerId: string }[]>`
        SELECT state, "organizerId" FROM reservation WHERE id = ${existing.id} FOR UPDATE
      `;
      if (rows.length === 0) return "missing";
      const reservation = await tx.reservation.findUnique({
        where: { id: existing.id },
        include: {
          lines: { include: { occurrence: { select: { startsAt: true } }, tickets: true } },
        },
      });
      if (!reservation) return "missing";
      if (reservation.state === "CANCELLED" || reservation.state === "EXPIRED") return "unchanged";

      if (reservation.state === "PENDING_HOLD") {
        for (const line of reservation.lines) {
          const inventory = await tx.ticketInventory.findFirst({
            where: { occurrenceId: line.occurrenceId, ticketTypeId: line.ticketTypeId },
            select: { id: true },
          });
          if (inventory) await releaseHeld(tx, inventory.id, line.quantity);
        }
      } else if (reservation.state === "CONFIRMED") {
        const earliest = new Date(
          Math.min(...reservation.lines.map((line) => line.occurrence.startsAt.getTime()))
        );
        if (!buyerCancellationAllowed(earliest, new Date())) {
          throw new HttpError(
            "POLICY_DENIED",
            "Buyer cancellation closes 24 hours before the first occurrence.",
            409
          );
        }
        for (const line of reservation.lines) {
          const inventory = await tx.ticketInventory.findFirst({
            where: { occurrenceId: line.occurrenceId, ticketTypeId: line.ticketTypeId },
            select: { id: true },
          });
          if (inventory) await releaseSold(tx, inventory.id, line.quantity);
        }
        await tx.issuedTicket.updateMany({
          where: { reservationLineId: { in: reservation.lines.map((line) => line.id) }, status: "VALID" },
          data: { status: "VOID", revokedAt: new Date(), revocationReason: "Reservation cancelled" },
        });
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          state: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason.slice(0, 300),
        },
      });
      await recordAudit(tx, {
        organizerId: rows[0].organizerId,
        action: "reservation.cancelled_by_buyer",
        targetType: "reservation",
        targetId: reservation.id,
        metadata: { previousState: reservation.state },
      });
      return "cancelled";
    },
    TX_OPTIONS
  );

  if (outcome === "missing") throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  return requireReservationByRef(ref);
}

export async function cancelReservationAsOrganizer(input: {
  reservationId: string;
  organizerId: string;
  actorUserId: string;
  reason: string;
}): Promise<ReservationView> {
  const outcome = await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ state: string; eventId: string; organizerId: string }[]>`
        SELECT state, "eventId", "organizerId" FROM reservation WHERE id = ${input.reservationId} FOR UPDATE
      `;
      if (rows.length === 0) return { kind: "missing" as const };
      if (rows[0].organizerId !== input.organizerId) return { kind: "missing" as const };
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        include: { lines: { include: { tickets: true } } },
      });
      if (!reservation) return { kind: "missing" as const };
      if (reservation.state === "CANCELLED" || reservation.state === "EXPIRED") {
        return { kind: "unchanged" as const };
      }
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
      await tx.issuedTicket.updateMany({
        where: {
          reservationLineId: { in: reservation.lines.map((line) => line.id) },
          status: "VALID",
        },
        data: {
          status: "VOID",
          revokedAt: new Date(),
          revocationReason: "Cancelled by organizer",
        },
      });
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          state: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: input.reason.slice(0, 300) || "Cancelled by organizer",
          accessVersion: { increment: 1 },
        },
      });
      await recordAudit(tx, {
        organizerId: input.organizerId,
        actorUserId: input.actorUserId,
        action: "reservation.cancelled_by_organizer",
        targetType: "reservation",
        targetId: reservation.id,
        metadata: { previousState: reservation.state, reason: input.reason.slice(0, 300) },
      });
      return { kind: "cancelled" as const, id: reservation.id, version: reservation.accessVersion + 1 };
    },
    TX_OPTIONS
  );

  if (outcome.kind === "missing") throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  if (outcome.kind === "unchanged") {
    const current = await prisma.reservation.findUnique({
      where: { id: input.reservationId },
      select: { id: true, accessVersion: true },
    });
    if (!current) throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
    return requireReservationByRef(reservationRef(current.id, current.accessVersion));
  }
  return requireReservationByRef(reservationRef(outcome.id, outcome.version));
}
