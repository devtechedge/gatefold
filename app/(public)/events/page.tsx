import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { catalogue } from "@/repositories/events";
import { CATEGORIES } from "@/domain/types";
import { eventListSchema } from "@/validation/schemas";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse independent events on sale through Gatefold.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string): string {
  const raw = params[key];
  return typeof raw === "string" ? raw : "";
}

function buildHref(params: SearchParams, patch: Record<string, string | null>): string {
  const next = new URLSearchParams();
  for (const key of ["q", "category", "from", "to", "price", "availability"]) {
    const existing = value(params, key);
    if (existing) next.set(key, existing);
  }
  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === null || patchValue === "") next.delete(key);
    else next.set(key, patchValue);
  }
  const query = next.toString();
  return query ? `/events?${query}` : "/events";
}

function pageHref(params: SearchParams, cursor: number): string {
  const next = new URLSearchParams();
  for (const key of ["q", "category", "from", "to", "price", "availability"]) {
    const existing = value(params, key);
    if (existing) next.set(key, existing);
  }
  next.set("cursor", String(cursor));
  return `/events?${next.toString()}`;
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const parsed = eventListSchema.safeParse({
    q: value(params, "q"),
    category: value(params, "category"),
    from: value(params, "from"),
    to: value(params, "to"),
    price: value(params, "price") || "ALL",
    availability: value(params, "availability") || "ALL",
    cursor: value(params, "cursor") || undefined,
    take: 12,
  });
  const filters = parsed.success
    ? parsed.data
    : {
        q: "",
        category: "",
        from: "",
        to: "",
        price: "ALL" as const,
        availability: "ALL" as const,
        cursor: undefined,
        take: 12,
      };
  const offset = Number.parseInt(filters.cursor ?? "0", 10);
  const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const { rows, hasMore } = await catalogue({
    q: filters.q,
    category: filters.category,
    from: filters.from,
    to: filters.to,
    price: filters.price,
    availability: filters.availability,
    offset: safeOffset,
    take: filters.take,
  });

  const hasFilters =
    Boolean(filters.q) ||
    Boolean(filters.category) ||
    Boolean(filters.from) ||
    Boolean(filters.to) ||
    filters.price !== "ALL" ||
    filters.availability !== "ALL";

  return (
    <div className="shell py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">The programme</p>
          <h1 className="display-l mt-3">All events</h1>
          <p className="lede mt-4 max-w-2xl">
            Published events with at least one upcoming date. Inventory is live, so an event marked
            sold out is sold out at this moment, not when the page was cached.
          </p>
        </div>
        <p className="mono text-xs faint">Page {Math.floor(safeOffset / filters.take) + 1}</p>
      </div>

      <form action="/events" method="get" className="card mt-6 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="label" htmlFor="q">Search</label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q}
              className="input"
              placeholder="Event, venue, organizer"
              maxLength={120}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={filters.category} className="select">
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={filters.from} className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={filters.to} className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="price">Price</label>
            <select id="price" name="price" defaultValue={filters.price} className="select">
              <option value="ALL">Any price</option>
              <option value="FREE">Free</option>
              <option value="UNDER_25">Under $25</option>
              <option value="25_50">$25 to $50</option>
              <option value="OVER_50">Over $50</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="label" htmlFor="availability">Availability</label>
            <select id="availability" name="availability" defaultValue={filters.availability} className="select">
              <option value="ALL">All events</option>
              <option value="AVAILABLE">Tickets available</option>
            </select>
          </div>
          <div className="md:col-span-9 flex items-end justify-end gap-2">
            <button type="submit" className="btn btn-primary">Apply filters</button>
            {hasFilters ? (
              <Link href="/events" className="btn btn-ghost">Clear</Link>
            ) : null}
          </div>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Category shortcuts">
        <Link
          href={buildHref(params, { category: null })}
          className={`chip ${filters.category ? "chip-outline" : "chip-dark"}`}
          aria-current={!filters.category ? "page" : undefined}
        >
          Everything
        </Link>
        {CATEGORIES.map((category) => (
          <Link
            key={category}
            href={buildHref(params, { category })}
            className={`chip ${filters.category === category ? "chip-dark" : "chip-outline"}`}
            aria-current={filters.category === category ? "page" : undefined}
          >
            {category}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="eyebrow">Nothing matches</p>
          <p className="mt-3 text-lg">No published events match those filters.</p>
          <p className="mt-2 text-sm muted">
            Try a wider date range, or clear the filters to see the whole programme.
          </p>
          <Link href="/events" className="btn mt-6">Reset the filters</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <nav aria-label="Pagination" className="mt-8 flex items-center justify-between border-t border-line pt-4">
        {safeOffset > 0 ? (
          <Link href={pageHref(params, Math.max(0, safeOffset - filters.take))} className="btn btn-sm">
            Previous
          </Link>
        ) : (
          <span className="mono text-xs faint">Start of programme</span>
        )}
        {hasMore ? (
          <Link href={pageHref(params, safeOffset + filters.take)} className="btn btn-sm">
            Next page
          </Link>
        ) : (
          <span className="mono text-xs faint">End of programme</span>
        )}
      </nav>
    </div>
  );
}
