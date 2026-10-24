import { withApi, jsonOk } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { HttpError } from "@/lib/errors";
import { requireReservationByRef } from "@/services/reservations";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ ref: string }> }>(async (request, context) => {
  const ip = clientIp(request.headers);
  const limit = await rateLimit(`reservation:ip:${ip}`, 120, 600);
  if (!limit.allowed) {
    throw new HttpError("RATE_LIMITED", "Too many reservation lookups. Try again shortly.", 429);
  }
  const { ref } = await context.params;
  const reservation = await requireReservationByRef(ref);
  return jsonOk({ data: reservation });
});
