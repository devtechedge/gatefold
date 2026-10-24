import { withApi, jsonOk } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { searchAttendees, attendeeTotals } from "@/services/attendees";
import { attendeeSearchSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  await eventAccess(user.id, id, "attendee:read");
  const url = new URL(request.url);
  const parsed = attendeeSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    state: url.searchParams.get("state") ?? "ALL",
    cursor: url.searchParams.get("cursor") ?? undefined,
    take: url.searchParams.get("take") ?? 25,
  });
  if (!parsed.success) {
    throw new HttpError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid filters.", 400);
  }
  const offset = Math.max(0, Number.parseInt(parsed.data.cursor ?? "0", 10) || 0);
  const [{ rows, hasMore }, totals] = await Promise.all([
    searchAttendees(id, {
      q: parsed.data.q,
      state: parsed.data.state,
      offset,
      take: parsed.data.take,
    }),
    attendeeTotals(id),
  ]);
  return jsonOk({
    data: rows.map((reservation) => ({
      id: reservation.id,
      state: reservation.state,
      buyer: { name: reservation.buyerName, email: reservation.buyerEmail },
      totalMinor: reservation.totalMinor,
      currency: reservation.currency,
      createdAt: reservation.createdAt.toISOString(),
      lines: reservation.lines.map((line) => ({
        id: line.id,
        label: line.ticketType.label,
        quantity: line.quantity,
        startsAt: line.occurrence.startsAt.toISOString(),
      })),
      tickets: reservation.lines.flatMap((line) =>
        line.tickets.map((ticket) => ({
          publicId: ticket.publicId,
          attendeeName: ticket.attendeeName,
          status: ticket.status,
          checkedInAt: ticket.checkIn?.scannedAt.toISOString() ?? null,
        }))
      ),
    })),
    totals,
    pagination: { nextCursor: hasMore ? String(offset + parsed.data.take) : null, hasMore },
  });
});
