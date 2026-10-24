import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";

export interface AttendeeFilters {
  q: string;
  state: "ALL" | "PENDING_HOLD" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  offset: number;
  take: number;
}

export async function searchAttendees(eventId: string, filters: AttendeeFilters) {
  const where = {
    eventId,
    ...(filters.state === "ALL" ? {} : { state: filters.state }),
    ...(filters.q
      ? {
          OR: [
            { buyerName: { contains: filters.q, mode: "insensitive" as const } },
            { buyerEmail: { contains: filters.q, mode: "insensitive" as const } },
            {
              lines: {
                some: {
                  tickets: {
                    some: { publicId: { contains: filters.q.toUpperCase() } },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const rows = await prisma.reservation.findMany({
    where,
    include: {
      lines: {
        include: {
          ticketType: { select: { label: true } },
          occurrence: { select: { startsAt: true } },
          tickets: { select: { publicId: true, attendeeName: true, status: true, checkIn: { select: { scannedAt: true } } } },
        },
      },
      demoConfirmation: { select: { reference: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: filters.offset,
    take: filters.take + 1,
  });
  return {
    rows: rows.slice(0, filters.take),
    hasMore: rows.length > filters.take,
  };
}

export async function reservationForOrganizer(eventId: string, reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      lines: {
        include: {
          ticketType: { select: { label: true } },
          occurrence: { select: { startsAt: true } },
          tickets: { include: { checkIn: true } },
        },
      },
      demoConfirmation: true,
    },
  });
  if (!reservation || reservation.eventId !== eventId) {
    throw new HttpError("NOT_FOUND", "Reservation not found.", 404);
  }
  return reservation;
}

export async function attendeeTotals(eventId: string) {
  const [confirmed, pending, cancelled, issued, checkedIn] = await Promise.all([
    prisma.reservation.count({ where: { eventId, state: "CONFIRMED" } }),
    prisma.reservation.count({ where: { eventId, state: "PENDING_HOLD" } }),
    prisma.reservation.count({ where: { eventId, state: "CANCELLED" } }),
    prisma.issuedTicket.count({ where: { reservationLine: { occurrence: { eventId } } } }),
    prisma.checkIn.count({ where: { ticket: { reservationLine: { occurrence: { eventId } } } } }),
  ]);
  return { confirmed, pending, cancelled, issued, checkedIn };
}
