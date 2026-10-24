import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { parseReservationRef, verifyReservationRef } from "@/lib/access";
import { randomBase32, ticketPublicId } from "@/lib/ids";
import { commitInventory, releaseHeld } from "@/repositories/inventory";
import { recordAudit } from "./audit";
import { requireReservationByRef, type ReservationView } from "./reservations";

interface AttendeeInput {
  lineId: string;
  names: string[];
}

interface TicketSeed {
  lineId: string;
  index: number;
  publicId: string;
  attendeeName: string;
}

async function resolveRef(ref: string) {
  const parsed = parseReservationRef(ref);
  if (!parsed) return null;
  const reservation = await prisma.reservation.findUnique({
    where: { id: parsed.id },
    select: { id: true, accessVersion: true },
  });
  if (!reservation || !verifyReservationRef(ref, reservation.id, reservation.accessVersion)) {
    return null;
  }
  return reservation;
}

/**
 * Completes the explicitly simulated checkout. No payment provider is called.
 * Repeating the request after confirmation returns the originally issued
 * tickets instead of issuing more.
 */
export async function demoCheckout(
  ref: string,
  attendeeInput: AttendeeInput[] = []
): Promise<ReservationView> {
  const target = await resolveRef(ref);
  if (!target) throw new HttpError("NOT_FOUND", "Reservation not found.", 404);

  const outcome = await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; state: string; accessVersion: number }[]>`
        SELECT id, state, "accessVersion" FROM reservation WHERE id = ${target.id} FOR UPDATE
      `;
      if (locked.length === 0) return { kind: "missing" as const };
      if (locked[0].accessVersion !== target.accessVersion) return { kind: "invalid" as const };

      const reservation = await tx.reservation.findUnique({
        where: { id: target.id },
        include: {
          lines: { include: { occurrence: true, tickets: true } },
          demoConfirmation: true,
        },
      });
      if (!reservation) return { kind: "missing" as const };

      if (reservation.state === "CONFIRMED") return { kind: "already" as const };
      if (reservation.state !== "PENDING_HOLD") return { kind: "invalid" as const };

      if (reservation.holdExpiresAt.getTime() <= Date.now()) {
        for (const line of reservation.lines) {
          const inventory = await tx.ticketInventory.findFirst({
            where: { occurrenceId: line.occurrenceId, ticketTypeId: line.ticketTypeId },
            select: { id: true },
          });
          if (inventory) await releaseHeld(tx, inventory.id, line.quantity);
        }
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { state: "EXPIRED", expiredAt: new Date() },
        });
        await recordAudit(tx, {
          organizerId: reservation.organizerId,
          action: "reservation.expired_at_checkout",
          targetType: "reservation",
          targetId: reservation.id,
        });
        return { kind: "expired" as const };
      }

      for (const line of reservation.lines) {
        const inventory = await tx.ticketInventory.findFirst({
          where: { occurrenceId: line.occurrenceId, ticketTypeId: line.ticketTypeId },
          select: { id: true },
        });
        if (!inventory) {
          throw new HttpError("CONFLICT", "Inventory is missing for a reservation line.", 409);
        }
        const committed = await commitInventory(tx, inventory.id, line.quantity);
        if (!committed) {
          throw new HttpError("CONFLICT", "Inventory could not be committed safely.", 409);
        }
      }

      const seeds: TicketSeed[] = [];
      const namesByLine = new Map(attendeeInput.map((entry) => [entry.lineId, entry.names]));
      for (const line of reservation.lines) {
        const provided = namesByLine.get(line.id) ?? [];
        for (let index = 0; index < line.quantity; index += 1) {
          const providedName = provided[index]?.trim();
          const fallback =
            index === 0 ? reservation.buyerName : `${reservation.buyerName} guest ${index + 1}`;
          seeds.push({
            lineId: line.id,
            index,
            publicId: ticketPublicId(),
            attendeeName: (providedName || fallback).slice(0, 120),
          });
        }
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { state: "CONFIRMED", confirmedAt: new Date() },
      });
      await tx.demoConfirmation.create({
        data: {
          reservationId: reservation.id,
          amountMinor: reservation.totalMinor,
          currency: reservation.currency,
          method: "demo",
          reference: `DEMO-${randomBase32(12)}`,
        },
      });
      for (const seed of seeds) {
        let created = false;
        for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
          try {
            await tx.issuedTicket.create({
              data: {
                reservationLineId: seed.lineId,
                publicId: attempt === 0 ? seed.publicId : ticketPublicId(),
                attendeeName: seed.attendeeName,
                attendeeEmail: reservation.buyerEmail,
              },
            });
            created = true;
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              (error as { code?: string }).code === "P2002"
            ) {
              continue;
            }
            throw error;
          }
        }
        if (!created) throw new HttpError("CONFLICT", "Ticket issuance failed. Try again.", 409);
      }
      await recordAudit(tx, {
        organizerId: reservation.organizerId,
        action: "reservation.confirmed_demo",
        targetType: "reservation",
        targetId: reservation.id,
        metadata: {
          ticketCount: seeds.length,
          amountMinor: reservation.totalMinor,
          method: "demo",
        },
      });
      return { kind: "confirmed" as const };
    },
    { timeout: 30_000 }
  );

  if (outcome.kind === "missing") throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  if (outcome.kind === "expired") {
    throw new HttpError("HOLD_EXPIRED", "That hold expired. Reserve again to continue.", 409);
  }
  if (outcome.kind === "invalid") {
    throw new HttpError("INVALID_STATE", "This reservation can no longer be confirmed.", 409);
  }
  return requireReservationByRef(ref);
}

export async function ticketView(publicId: string) {
  const ticket = await prisma.issuedTicket.findUnique({
    where: { publicId },
    include: {
      checkIn: true,
      reservationLine: {
        include: {
          reservation: { select: { state: true, buyerName: true, buyerEmail: true } },
          occurrence: true,
          ticketType: true,
          // event and venue are reached through the occurrence below
        },
      },
    },
  });
  if (!ticket) return null;
  const occurrence = await prisma.eventOccurrence.findUnique({
    where: { id: ticket.reservationLine.occurrenceId },
    include: { event: { include: { venue: true, organizer: true } } },
  });
  if (!occurrence) return null;
  const usable =
    ticket.status === "VALID" &&
    ticket.reservationLine.reservation.state === "CONFIRMED" &&
    occurrence.event.status === "PUBLISHED" &&
    occurrence.status === "SCHEDULED";
  return { ticket, occurrence, usable };
}
