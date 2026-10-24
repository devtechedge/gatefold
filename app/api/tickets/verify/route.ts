import { withApi, jsonOk, parseValidation, readJson, assertSameOrigin } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { rateLimit } from "@/lib/auth/rate-limit";
import { HttpError } from "@/lib/errors";
import { verifyTicket } from "@/services/checkin";
import { verifySchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const POST = withApi(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const body = await readJson<unknown>(request);
  const input = parseValidation(verifySchema.safeParse(body));
  if (!input.eventId) {
    throw new HttpError("VALIDATION_ERROR", "eventId is required so the scan can be scoped.", 400);
  }
  await eventAccess(user.id, input.eventId, "checkin:perform");
  const limit = await rateLimit(`verify:staff:${user.id}`, 240, 60);
  if (!limit.allowed) {
    throw new HttpError("RATE_LIMITED", "Too many scans in a minute. Slow down for a moment.", 429);
  }
  const result = await verifyTicket({
    payload: input.payload,
    staffUserId: user.id,
    expectedEventId: input.eventId,
    gateLabel: input.gateLabel,
    method: input.method,
  });
  return jsonOk({ data: result });
});
