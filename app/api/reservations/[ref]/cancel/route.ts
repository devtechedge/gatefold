import { withApi, jsonOk, readJson, assertSameOrigin } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { HttpError } from "@/lib/errors";
import { cancelReservationByRef } from "@/services/reservations";
import { cancelSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const POST = withApi<{ params: Promise<{ ref: string }> }>(async (request, context) => {
  assertSameOrigin(request);
  const ip = clientIp(request.headers);
  const limit = await rateLimit(`cancel:ip:${ip}`, 20, 600);
  if (!limit.allowed) {
    throw new HttpError("RATE_LIMITED", "Too many cancellation attempts. Try again shortly.", 429);
  }
  const { ref } = await context.params;
  const body = await readJson<unknown>(request).catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  const reservation = await cancelReservationByRef(
    ref,
    parsed.success && parsed.data.reason ? parsed.data.reason : "Cancelled by buyer"
  );
  return jsonOk({ data: reservation });
});
