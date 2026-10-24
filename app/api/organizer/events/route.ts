import { withApi, jsonOk, parseValidation, readJson, assertSameOrigin } from "@/lib/http";
import { requireApiUser, organizerContext } from "@/lib/auth/organizer";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { organizerEvents } from "@/repositories/events";
import { createEvent } from "@/services/events";
import { eventCreateSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const user = await requireApiUser();
  const organizerId = new URL(request.url).searchParams.get("organizerId") ?? "";
  if (!organizerId) throw new HttpError("VALIDATION_ERROR", "organizerId is required.", 400);
  await organizerContext(user.id, organizerId, "event:manage");
  const events = await organizerEvents(organizerId);
  return jsonOk({
    data: events.map((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug,
      status: event.status,
      category: event.category,
      nextOccurrence: event.occurrences[0]?.startsAt.toISOString() ?? null,
      ticketTypeCount: event.ticketTypes.length,
    })),
  });
});

export const POST = withApi(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const body = await readJson<Record<string, unknown>>(request);
  const organizerId = typeof body.organizerId === "string" ? body.organizerId : "";
  if (!organizerId) throw new HttpError("VALIDATION_ERROR", "organizerId is required.", 400);
  await organizerContext(user.id, organizerId, "event:manage");
  const input = parseValidation(eventCreateSchema.safeParse(body));
  const created = await createEvent(input, organizerId, user.id);
  const event = await prisma.event.findUnique({ where: { id: created.id }, select: { id: true, slug: true, status: true } });
  return jsonOk({ data: event }, 201);
});
