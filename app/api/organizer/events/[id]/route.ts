import { withApi, jsonOk, readJson, assertSameOrigin } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { eventForOrganizer } from "@/repositories/events";
import {
  publishEvent,
  unpublishEvent,
  cancelEvent,
  updateEvent,
} from "@/services/events";
import { eventUpdateSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  const access = await eventAccess(user.id, id, "event:manage");
  const event = await eventForOrganizer(id);
  if (!event) throw new HttpError("NOT_FOUND", "Event not found.", 404);
  return jsonOk({
    data: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      status: event.status,
      category: event.category,
      timezone: event.timezone,
      organizerId: access.event.organizerId,
      occurrences: event.occurrences.map((occurrence) => ({
        id: occurrence.id,
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString(),
        status: occurrence.status,
        label: occurrence.label,
        inventories: occurrence.inventories.map((row) => ({
          id: row.id,
          ticketTypeId: row.ticketTypeId,
          capacity: row.capacity,
          held: row.held,
          sold: row.sold,
        })),
      })),
      ticketTypes: event.ticketTypes.map((type) => ({
        id: type.id,
        label: type.label,
        priceMinor: type.priceMinor,
        currency: type.currency,
        status: type.status,
        salesStartAt: type.salesStartAt?.toISOString() ?? null,
        salesEndAt: type.salesEndAt?.toISOString() ?? null,
      })),
    },
  });
});

export const PATCH = withApi<{ params: Promise<{ id: string }> }>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);
  const action = typeof body.action === "string" ? body.action : "";
  const access = await eventAccess(user.id, id, "event:manage");

  if (action === "publish") {
    await publishEvent(id, access.event.organizerId, user.id);
  } else if (action === "unpublish") {
    await unpublishEvent(id, access.event.organizerId, user.id);
  } else if (action === "cancel") {
    await cancelEvent(id, access.event.organizerId, user.id, String(body.reason ?? ""));
  } else if (action === "update") {
    const parsed = eventUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid event.", 400);
    }
    await updateEvent(id, access.event.organizerId, user.id, parsed.data);
  } else {
    throw new HttpError("VALIDATION_ERROR", "Unknown action.", 400);
  }
  return jsonOk({ data: { id, action } });
});
