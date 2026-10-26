import { withApi, jsonOk, readJson, assertSameOrigin } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { eventStaff, setEventStaffAssignment } from "@/services/events";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  const access = await eventAccess(user.id, id, "event:manage");
  return jsonOk({ data: await eventStaff(id, access.event.organizerId) });
});

export const POST = withApi<{ params: Promise<{ id: string }> }>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await context.params;
  const access = await eventAccess(user.id, id, "event:manage");
  const body = await readJson<Record<string, unknown>>(request);
  if (typeof body.userId !== "string" || typeof body.assigned !== "boolean") {
    throw new HttpError("VALIDATION_ERROR", "userId and assigned are required.", 400);
  }
  await setEventStaffAssignment({
    eventId: id,
    organizerId: access.event.organizerId,
    actorUserId: user.id,
    userId: body.userId,
    assigned: body.assigned,
  });
  return jsonOk({ data: { ok: true } });
});
