import { withApi, jsonOk } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { checkInStats, recentCheckIns } from "@/services/checkin";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  await eventAccess(user.id, id, "checkin:perform");
  const [stats, recent] = await Promise.all([checkInStats(id), recentCheckIns(id, 20)]);
  return jsonOk({
    data: {
      stats,
      recent: recent.map((entry) => ({
        id: entry.id,
        scannedAt: entry.scannedAt.toISOString(),
        gateLabel: entry.gateLabel,
        method: entry.method,
        staff: entry.staff.displayName,
        attendee: entry.ticket.attendeeName,
        ticketType: entry.ticket.reservationLine.ticketType.label,
      })),
    },
  });
});
