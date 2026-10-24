import { withApi, jsonOk } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { eventForOrganizer } from "@/repositories/events";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  await eventAccess(user.id, id, "event:manage");
  const event = await eventForOrganizer(id);
  if (!event) throw new HttpError("NOT_FOUND", "Event not found.", 404);
  return jsonOk({
    data: {
      timezone: event.timezone,
      occurrences: event.occurrences.map((occurrence) => ({
        id: occurrence.id,
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString(),
        label: occurrence.label,
        status: occurrence.status,
      })),
    },
  });
});
