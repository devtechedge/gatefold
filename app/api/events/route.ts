import { withApi, jsonOk, parseValidation } from "@/lib/http";
import { catalogue } from "@/repositories/events";
import { eventListSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const url = new URL(request.url);
  const parsed = eventListSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    category: url.searchParams.get("category") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
    price: url.searchParams.get("price") ?? "ALL",
    availability: url.searchParams.get("availability") ?? "ALL",
    cursor: url.searchParams.get("cursor") ?? undefined,
    take: Math.min(24, Math.max(1, Number(url.searchParams.get("take") ?? 12) || 12)),
  });
  const filters = parseValidation(parsed);
  const offset = Math.max(0, Number.parseInt(filters.cursor ?? "0", 10) || 0);
  const { rows, hasMore } = await catalogue({
    q: filters.q,
    category: filters.category,
    from: filters.from,
    to: filters.to,
    price: filters.price,
    availability: filters.availability,
    offset,
    take: filters.take,
  });
  return jsonOk({
    data: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      artwork: row.artwork,
      timezone: row.timezone,
      organizer: row.organizerName,
      venue: { name: row.venueName, address: row.venueAddress },
      nextStart: row.nextStart.toISOString(),
      minPriceMinor: row.minPrice,
      currency: row.currency,
      remaining: row.remaining,
    })),
    pagination: {
      nextCursor: hasMore ? String(offset + filters.take) : null,
      hasMore,
    },
  });
});
