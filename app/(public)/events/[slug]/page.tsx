import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPanel, type BookingOccurrence } from "@/components/booking-panel";
import { EventArtwork } from "@/components/event-artwork";
import { findBySlug } from "@/repositories/events";
import { salesState } from "@/domain/event";
import { remaining } from "@/domain/inventory";
import { formatDate, formatDateTime, formatMoney, formatTime, formatTimeRange, formatDateTimeWithZone } from "@/lib/dates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await findBySlug(slug);
  if (!event || event.status === "DRAFT") return { title: "Event not found" };
  return {
    title: event.title,
    description: event.description.slice(0, 180),
    openGraph: {
      title: event.title,
      description: event.description.slice(0, 200),
      type: "website",
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await findBySlug(slug);
  if (!event || event.status === "DRAFT") notFound();

  const now = new Date();
  const futureOccurrences = event.occurrences.filter(
    (occurrence) => occurrence.status === "SCHEDULED" && occurrence.startsAt.getTime() > now.getTime()
  );
  const cancelled = event.status === "CANCELLED";

  const bookingOccurrences: BookingOccurrence[] = futureOccurrences.map((occurrence) => ({
    id: occurrence.id,
    label: occurrence.label,
    startDisplay: formatDateTime(occurrence.startsAt, event.timezone),
    endDisplay: formatTime(occurrence.endsAt, event.timezone),
    tickets: event.ticketTypes.map((type) => {
      const inventory = occurrence.inventories.find((row) => row.ticketTypeId === type.id);
      const left = inventory ? remaining(inventory) : 0;
      const state = salesState(
        {
          salesStartAt: type.salesStartAt,
          salesEndAt: type.salesEndAt,
          occurrenceStartsAt: occurrence.startsAt,
        },
        now
      );
      return {
        id: type.id,
        label: type.label,
        description: type.description,
        priceMinor: type.priceMinor,
        currency: type.currency,
        remaining: left,
        onSale: !cancelled && state === "ON_SALE" && left > 0,
        salesNote:
          state === "UPCOMING" && type.salesStartAt
            ? `Sales open ${formatDateTime(type.salesStartAt, event.timezone)}.`
            : state === "CLOSED"
              ? "Sales closed for this date."
              : "",
      };
    }),
  }));

  const totalRemaining = bookingOccurrences.reduce(
    (sum, occurrence) => sum + occurrence.tickets.reduce((rowSum, ticket) => rowSum + ticket.remaining, 0),
    0
  );
  const soldOut = bookingOccurrences.length > 0 && totalRemaining === 0;
  const minPrice = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((type) => type.priceMinor))
    : 0;
  const currency = event.ticketTypes[0]?.currency ?? "USD";
  const paragraphs = event.description.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="pb-24 lg:pb-0">
      <div className="shell py-6">
        <nav aria-label="Breadcrumb" className="eyebrow">
          <Link href="/events" className="link">Events</Link>
          <span aria-hidden="true"> / </span>
          <span>{event.category}</span>
        </nav>
      </div>

      <section className="shell">
        <div className="grid items-stretch gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <EventArtwork artwork={event.artwork} title={event.title} className="min-h-[260px] border border-ink lg:min-h-[360px]" />
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{event.category}</span>
                {cancelled ? <span className="chip chip-accent">Cancelled</span> : null}
                {soldOut && !cancelled ? <span className="chip chip-dark">Sold out</span> : null}
                <span className="eyebrow">{event.organizer.name}</span>
              </div>
              <h1 className="display-l mt-4 max-w-[16ch]">{event.title}</h1>
              {futureOccurrences[0] ? (
                <p className="mt-4 text-lg">
                  {formatDate(futureOccurrences[0].startsAt, event.timezone)}
                  <span className="faint"> / </span>
                  {formatTimeRange(futureOccurrences[0].startsAt, futureOccurrences[0].endsAt, event.timezone)}
                  {futureOccurrences.length > 1 ? ` and ${futureOccurrences.length - 1} more date${futureOccurrences.length > 2 ? "s" : ""}` : ""}
                </p>
              ) : (
                <p className="mt-4 text-lg faint">No upcoming dates</p>
              )}
              <p className="mt-3 text-sm muted">
                {event.venue.name} / {event.venue.address}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
              <div>
                <p className="eyebrow">Tickets</p>
                <p className="mt-1 text-xl mono">
                  {event.ticketTypes.length === 0
                    ? "Not configured"
                    : minPrice === 0
                      ? "Free entry"
                      : `From ${formatMoney(minPrice, currency)}`}
                </p>
              </div>
              <p className="text-sm muted">
                All times shown in {event.timezone.replace("_", " ")}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {cancelled ? (
        <div className="shell mt-8">
          <div className="notice notice-error">
            <p className="text-lg">This event has been cancelled.</p>
            <p className="mt-2 text-sm">
              {event.cancellationPolicy} No payment was collected in this demo.
            </p>
          </div>
        </div>
      ) : null}

      <section className="shell mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <div className="prose-block">
            <p className="eyebrow">The programme</p>
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-4 text-[1.02rem] muted">{paragraph}</p>
            ))}
          </div>

          <div className="mt-12">
            <div className="section-label">Schedule</div>
            <ol className="mt-5 divide-y divide-line border-y border-line">
              {event.occurrences.map((occurrence) => (
                <li key={occurrence.id} className="grid gap-2 py-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
                  <div>
                    <p className="mono text-sm">{formatDate(occurrence.startsAt, event.timezone)}</p>
                    <p className="text-xs faint">{formatTimeRange(occurrence.startsAt, occurrence.endsAt, event.timezone)}</p>
                  </div>
                  <div>
                    <p className="text-sm">{occurrence.label || "Doors and programme"}</p>
                    <p className="text-xs faint">{formatDateTimeWithZone(occurrence.startsAt, event.timezone)}</p>
                  </div>
                  <span className={`chip ${occurrence.status === "CANCELLED" ? "chip-accent" : "chip-outline"}`}>
                    {occurrence.status === "CANCELLED" ? "Cancelled" : "Scheduled"}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <div>
              <div className="section-label">Venue</div>
              <h2 className="display-m mt-4">{event.venue.name}</h2>
              <p className="mt-2 text-sm muted">{event.venue.address}</p>
              <p className="mt-1 mono text-xs faint">{event.venue.timezone.replace("_", " ")}</p>
              {event.venue.accessibility ? (
                <p className="mt-4 border-l-2 border-accent pl-3 text-sm muted">
                  {event.venue.accessibility}
                </p>
              ) : null}
            </div>
            <div>
              <div className="section-label">Organizer</div>
              <h2 className="display-m mt-4">{event.organizer.name}</h2>
              <p className="mt-2 text-sm muted">
                Publishing through Gatefold with server-side inventory and signed tickets.
              </p>
              <p className="mt-4 text-sm faint">
                Questions about access or the programme go to the organizer at the door.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <div className="section-label">Ticket types</div>
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Price</th>
                    <th scope="col">Sales window</th>
                    <th scope="col">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {event.ticketTypes.map((type) => {
                    const left = futureOccurrences.reduce((sum, occurrence) => {
                      const inventory = occurrence.inventories.find((row) => row.ticketTypeId === type.id);
                      return sum + (inventory ? remaining(inventory) : 0);
                    }, 0);
                    return (
                      <tr key={type.id}>
                        <td>
                          <p className="font-medium">{type.label}</p>
                          {type.description ? <p className="mt-1 text-xs muted">{type.description}</p> : null}
                        </td>
                        <td className="mono">{type.priceMinor === 0 ? "Free" : formatMoney(type.priceMinor, type.currency)}</td>
                        <td className="text-xs muted">
                          {type.salesStartAt ? formatDateTime(type.salesStartAt, event.timezone) : "On sale now"}
                          <br />
                          {type.salesEndAt ? `until ${formatDateTime(type.salesEndAt, event.timezone)}` : "until the event starts"}
                        </td>
                        <td>
                          <span className={`chip ${left === 0 ? "chip-outline" : left <= 5 ? "chip-accent" : ""}`}>
                            {left === 0 ? "Sold out" : `${left} across dates`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 border border-line bg-paper-2 p-5">
            <p className="eyebrow">Cancellation policy</p>
            <p className="mt-3 text-sm muted">{event.cancellationPolicy}</p>
            <p className="mt-3 text-xs faint">
              Demo checkout records a simulated confirmation. No payment is collected and no refund
              is processed.
            </p>
          </div>
        </div>

        <aside className="min-w-0">
          <div className="lg:sticky lg:top-24">
            {cancelled ? (
              <div id="tickets" className="card-hard p-5">
                <p className="eyebrow">Tickets</p>
                <p className="mt-3 text-lg">Booking is closed.</p>
                <p className="mt-2 text-sm muted">The organizer cancelled this event.</p>
              </div>
            ) : (
              <BookingPanel eventId={event.id} occurrences={bookingOccurrences} soldOut={soldOut} />
            )}
          </div>
        </aside>
      </section>

      {!cancelled ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper p-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Tickets</p>
              <p className="mono text-sm">
                {minPrice === 0 ? "Free entry" : `From ${formatMoney(minPrice, currency)}`}
              </p>
            </div>
            {soldOut ? (
              <span className="btn btn-ghost" style={{ opacity: 0.6 }}>Sold out</span>
            ) : (
              <a href="#tickets" className="btn btn-primary">Choose tickets</a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
