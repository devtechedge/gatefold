import { withApi, jsonOk, parseValidation, readJson, assertSameOrigin } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { reservationCreateSchema } from "@/validation/schemas";
import { createHold } from "@/services/reservations";
import { sha256 } from "@/lib/ids";

export const dynamic = "force-dynamic";

export const POST = withApi<{ params: Promise<{ slug: string }> }>(async (request, context) => {
  assertSameOrigin(request);
  const { slug } = await context.params;
  const ip = clientIp(request.headers);
  const ipLimit = await rateLimit(`reserve:ip:${ip}`, 20, 600);
  if (!ipLimit.allowed) {
    throw new HttpError("RATE_LIMITED", "Too many hold attempts. Wait a few minutes and try again.", 429);
  }
  const body = await readJson<unknown>(request);
  const input = parseValidation(reservationCreateSchema.safeParse(body));
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: slug }, { slug }] },
    select: { id: true },
  });
  if (!event) throw new HttpError("NOT_FOUND", "Event not found.", 404);
  if (input.eventId !== event.id) {
    throw new HttpError("VALIDATION_ERROR", "The event does not match the request path.", 400);
  }
  const emailLimit = await rateLimit(`reserve:email:${sha256(input.buyer.email).slice(0, 32)}`, 8, 3600);
  if (!emailLimit.allowed) {
    throw new HttpError("RATE_LIMITED", "That email has created several holds recently. Try again later.", 429);
  }
  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
  const result = await createHold(input, idempotencyKey);
  return jsonOk(result, 201);
});
