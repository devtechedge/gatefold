import { withApi, jsonOk, readJson, assertSameOrigin } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { HttpError } from "@/lib/errors";
import { demoCheckout } from "@/services/checkout";
import { checkoutSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const POST = withApi<{ params: Promise<{ ref: string }> }>(async (request, context) => {
  assertSameOrigin(request);
  const ip = clientIp(request.headers);
  const limit = await rateLimit(`checkout:ip:${ip}`, 30, 600);
  if (!limit.allowed) {
    throw new HttpError("RATE_LIMITED", "Too many checkout attempts. Try again shortly.", 429);
  }
  const { ref } = await context.params;
  const body = await readJson<unknown>(request).catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  const attendees = parsed.success ? (parsed.data.attendees ?? []) : [];
  const reservation = await demoCheckout(ref, attendees);
  return jsonOk({ data: reservation });
});
