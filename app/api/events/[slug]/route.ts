import { withApi, jsonOk } from "@/lib/http";
import { HttpError } from "@/lib/errors";
import { findBySlug } from "@/repositories/events";
import { remaining } from "@/domain/inventory";
import { salesState } from "@/domain/event";

export const dynamic = "force-dynamic";

export const GET = withApi<{ params: Promise<{ slug: string }> }>(async (_request, context) => {
  const { slug } = await context.params;
  const event = await findBySlug(slug);
  if (!event || event.status === "DRAFT") throw new HttpError("NOT_FOUND", "Event not found.", 404);
  const now = new Date();
  return jsonOk({
    data: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      category: event.category,
      status: event.status,
      artwork: event.artwork,
      timezone: event.timezone,
      organizer: { name: event.organizer.name, slug: event.organizer.slug },
      venue: {
        name: event.venue.name,
        address: event.venue.address,
        timezone: event.venue.timezone,
        accessibility: event.venue.accessibility,
      },
      cancellationPolicy: event.cancellationPolicy,
      occurrences: event.occurrences.map((occurrence) => ({
        id: occurrence.id,
        label: occurrence.label,
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString(),
        status: occurrence.status,
      })),
      ticketTypes: event.ticketTypes.map((type) => ({
        id: type.id,
        label: type.label,
        description: type.description,
        priceMinor: type.priceMinor,
        currency: type.currency,
        salesStartAt: type.salesStartAt?.toISOString() ?? null,
        salesEndAt: type.salesEndAt?.toISOString() ?? null,
        availability: event.occurrences.map((occurrence) => {
          const inventory = occurrence.inventories.find((row) => row.ticketTypeId === type.id);
          return {
            occurrenceId: occurrence.id,
            remaining: inventory ? remaining(inventory) : 0,
            saleState: salesState(
              {
                salesStartAt: type.salesStartAt,
                salesEndAt: type.salesEndAt,
                occurrenceStartsAt: occurrence.startsAt,
              },
              now
            ),
          };
        }),
      })),
    },
  });
});
