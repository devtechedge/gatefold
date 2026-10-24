import Link from "next/link";
import { EventArtwork } from "./event-artwork";
import { formatDate, formatMoney, formatMonth, formatDay, formatTime } from "@/lib/dates";
import type { CatalogueRow } from "@/repositories/events";

export function AvailabilityBadge({ remaining }: { remaining: number }) {
  if (remaining <= 0) {
    return <span className="chip chip-outline">Sold out</span>;
  }
  if (remaining <= 5) {
    return <span className="chip chip-accent">{remaining} left</span>;
  }
  return <span className="chip">On sale</span>;
}

export function EventCard({ event }: { event: CatalogueRow }) {
  return (
    <article className="group border border-line bg-paper-2 transition-transform duration-150 hover:-translate-y-1">
      <Link href={`/events/${event.slug}`} className="block focus-visible:outline-offset-4">
        <div className="relative">
          <EventArtwork artwork={event.artwork} title={event.title} className="aspect-[5/3] w-full" />
          <div className="absolute left-0 top-0 flex items-stretch border-b border-r border-ink bg-paper">
            <span className="mono px-2 py-1 text-[0.62rem] uppercase tracking-[0.12em]">
              {formatMonth(event.nextStart, event.timezone)}
            </span>
            <span
              className="border-l border-ink px-2 py-1"
              style={{ fontFamily: "var(--type-display)", fontSize: "1.3rem", lineHeight: 1 }}
            >
              {formatDay(event.nextStart, event.timezone)}
            </span>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">{event.category}</span>
            <AvailabilityBadge remaining={event.remaining} />
          </div>
          <h3 className="display-m text-[1.45rem] leading-[1.05]">{event.title}</h3>
          <div className="space-y-1 text-sm muted">
            <p>
              {formatDate(event.nextStart, event.timezone)} at {formatTime(event.nextStart, event.timezone)}
            </p>
            <p>
              {event.venueName} / {event.organizerName}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="mono text-sm">
              {event.minPrice === 0 ? "Free entry" : `From ${formatMoney(event.minPrice, event.currency)}`}
            </span>
            <span className="eyebrow group-hover:text-accent-ink">View event</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
