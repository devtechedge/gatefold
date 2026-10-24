import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { normalizeTicketCode } from "@/lib/ids";
import { verifyQrPayload } from "@/domain/ticket";
import { recordAudit } from "./audit";

export interface CheckInResult {
  result: "CHECKED_IN" | "ALREADY_USED";
  ticket: {
    publicId: string;
    attendeeName: string;
    ticketType: string;
    eventTitle: string;
    startsAt: string;
  };
  checkIn: {
    scannedAt: string;
    gateLabel: string;
  };
  message: string;
}

export async function verifyTicket(input: {
  payload: string;
  staffUserId: string;
  expectedEventId?: string;
  gateLabel?: string;
  method?: "SCAN" | "MANUAL";
}): Promise<CheckInResult> {
  const verification = verifyQrPayload(input.payload);
  if (verification.kind === "invalid") {
    throw new HttpError("INVALID_SIGNATURE", "That QR payload is not a Gatefold ticket.", 400);
  }
  const publicId =
    verification.kind === "signed" ? verification.publicId : normalizeTicketCode(input.payload);

  const ticket = await prisma.issuedTicket.findUnique({
    where: { publicId },
    include: {
      checkIn: true,
      reservationLine: {
        include: {
          reservation: { select: { state: true, id: true } },
          ticketType: { select: { label: true } },
          occurrence: { include: { event: true } },
        },
      },
    },
  });
  if (!ticket) throw new HttpError("NOT_FOUND", "Ticket not recognised.", 404);

  const occurrence = ticket.reservationLine.occurrence;
  const event = occurrence.event;
  if (input.expectedEventId && event.id !== input.expectedEventId) {
    throw new HttpError("WRONG_EVENT", "That ticket belongs to a different event.", 409);
  }
  if (ticket.status !== "VALID") {
    throw new HttpError("INVALID_STATE", "That ticket has been voided.", 409);
  }
  if (ticket.reservationLine.reservation.state !== "CONFIRMED") {
    throw new HttpError("INVALID_STATE", "That reservation is not confirmed.", 409);
  }
  if (event.status !== "PUBLISHED" && event.status !== "COMPLETED") {
    throw new HttpError("INVALID_STATE", "That event is not accepting check-ins.", 409);
  }
  if (occurrence.status !== "SCHEDULED") {
    throw new HttpError("INVALID_STATE", "That occurrence was cancelled.", 409);
  }

  const baseTicket = {
    publicId: ticket.publicId,
    attendeeName: ticket.attendeeName,
    ticketType: ticket.reservationLine.ticketType.label,
    eventTitle: event.title,
    startsAt: occurrence.startsAt.toISOString(),
  };

  if (ticket.checkIn) {
    return {
      result: "ALREADY_USED",
      ticket: baseTicket,
      checkIn: {
        scannedAt: ticket.checkIn.scannedAt.toISOString(),
        gateLabel: ticket.checkIn.gateLabel,
      },
      message: `Already checked in at ${ticket.checkIn.scannedAt.toLocaleString("en-US")}.`,
    };
  }

  try {
    const checkIn = await prisma.$transaction(async (tx) => {
      const created = await tx.checkIn.create({
        data: {
          ticketId: ticket.id,
          staffUserId: input.staffUserId,
          gateLabel: input.gateLabel ?? "",
          method: input.method ?? "SCAN",
        },
      });
      await recordAudit(tx, {
        organizerId: event.organizerId,
        actorUserId: input.staffUserId,
        action: "ticket.checked_in",
        targetType: "issued_ticket",
        targetId: ticket.id,
        metadata: { method: input.method ?? "SCAN", gateLabel: input.gateLabel ?? "" },
      });
      return created;
    });
    return {
      result: "CHECKED_IN",
      ticket: baseTicket,
      checkIn: { scannedAt: checkIn.scannedAt.toISOString(), gateLabel: checkIn.gateLabel },
      message: "Checked in. Hand over the wristband.",
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const existing = await prisma.checkIn.findUnique({ where: { ticketId: ticket.id } });
      if (existing) {
        return {
          result: "ALREADY_USED",
          ticket: baseTicket,
          checkIn: {
            scannedAt: existing.scannedAt.toISOString(),
            gateLabel: existing.gateLabel,
          },
          message: `Already checked in at ${existing.scannedAt.toLocaleString("en-US")}.`,
        };
      }
    }
    throw error;
  }
}

export async function recentCheckIns(eventId: string, take = 12) {
  return prisma.checkIn.findMany({
    where: { ticket: { reservationLine: { occurrence: { eventId } } } },
    include: {
      ticket: {
        include: {
          reservationLine: {
            include: { ticketType: { select: { label: true } }, occurrence: true },
          },
        },
      },
      staff: { select: { displayName: true } },
    },
    orderBy: { scannedAt: "desc" },
    take,
  });
}

export async function checkInStats(eventId: string): Promise<{ issued: number; checkedIn: number }> {
  const [issued, checkedIn] = await Promise.all([
    prisma.issuedTicket.count({
      where: {
        reservationLine: { occurrence: { eventId } },
        status: "VALID",
      },
    }),
    prisma.checkIn.count({
      where: { ticket: { reservationLine: { occurrence: { eventId } } } },
    }),
  ]);
  return { issued, checkedIn };
}
