import { withApi, jsonOk, readJson, assertSameOrigin } from "@/lib/http";
import { requireApiUser, eventAccess } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { eventForOrganizer } from "@/repositories/events";
import { addTicketType, setTicketTypeStatus, setTicketTypeVisibility, updateCapacity } from "@/services/events";
import { ticketTypeCreateSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ id: string }> }>(async (_request, context) => {
  const user = await requireApiUser();
  const { id } = await context.params;
  await eventAccess(user.id, id, "ticket:manage");
  const event = await eventForOrganizer(id);
  if (!event) throw new HttpError("NOT_FOUND", "Event not found.", 404);
  return jsonOk({
    data: {
      occurrences: event.occurrences.map((occurrence) => ({
        id: occurrence.id,
        startsAt: occurrence.startsAt.toISOString(),
        label: occurrence.label,
        inventories: occurrence.inventories.map((row) => ({
          id: row.id,
          ticketTypeId: row.ticketTypeId,
          capacity: row.capacity,
          held: row.held,
          sold: row.sold,
        })),
      })),
      ticketTypes: event.ticketTypes,
    },
  });
});

export const POST = withApi<{ params: Promise<{ id: string }> }>(async (request, context) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await context.params;
  const access = await eventAccess(user.id, id, "ticket:manage");
  const body = await readJson<Record<string, unknown>>(request);
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "add") {
    const parsed = ticketTypeCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid ticket type.", 400);
    }
    await addTicketType({
      eventId: id,
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      ...parsed.data,
      capacity: Number(parsed.data.capacity),
    });
    return jsonOk({ data: { ok: true } }, 201);
  }

  if (action === "capacity") {
    await updateCapacity({
      inventoryId: String(body.inventoryId ?? ""),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      capacity: Number(body.capacity),
    });
    return jsonOk({ data: { ok: true } });
  }

  if (action === "visibility") {
    const visibility = body.visibility === "HIDDEN" ? "HIDDEN" : "PUBLIC";
    await setTicketTypeVisibility({
      ticketTypeId: String(body.ticketTypeId ?? ""),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      visibility,
    });
    return jsonOk({ data: { ok: true } });
  }

  if (action === "status") {
    const status = body.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
    await setTicketTypeStatus({
      ticketTypeId: String(body.ticketTypeId ?? ""),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      status,
    });
    return jsonOk({ data: { ok: true } });
  }

  throw new HttpError("VALIDATION_ERROR", "Unknown action.", 400);
});
