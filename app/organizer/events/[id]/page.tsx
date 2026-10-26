import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { eventAccess } from "@/lib/auth/organizer";
import { can } from "@/domain/permissions";
import { eventForOrganizer } from "@/repositories/events";
import { attendeeTotals } from "@/services/attendees";
import { checkInStats } from "@/services/checkin";
import { EventEditForm } from "@/components/organizer/event-edit-form";
import { ActionForm } from "@/components/action-form";
import {
  publishEventAction,
  unpublishEventAction,
  cancelEventAction,
} from "@/app/organizer/actions";
import { formatDateTime, formatMoney } from "@/lib/dates";

export const metadata: Metadata = { title: "Event operations", robots: { index: false } };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/organizer/events/${id}`);
  const base = await eventAccess(user.id, id, "checkin:perform").catch(() => null);
  if (!base) notFound();
  if (base.role === "CHECKIN") redirect(`/organizer/events/${id}/check-in`);
  if (!can(base.role, "event:manage")) notFound();

  const event = await eventForOrganizer(id);
  if (!event) notFound();
  const [totals, desk] = await Promise.all([attendeeTotals(id), checkInStats(id)]);

  const capacity = event.occurrences.reduce(
    (sum, occurrence) => sum + occurrence.inventories.reduce((rowSum, row) => rowSum + row.capacity, 0),
    0
  );
  const sold = event.occurrences.reduce(
    (sum, occurrence) => sum + occurrence.inventories.reduce((rowSum, row) => rowSum + row.sold, 0),
    0
  );
  const held = event.occurrences.reduce(
    (sum, occurrence) => sum + occurrence.inventories.reduce((rowSum, row) => rowSum + row.held, 0),
    0
  );
  const minPrice = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((type) => type.priceMinor))
    : 0;
  const currency = event.ticketTypes[0]?.currency ?? "USD";
  const cancelled = event.status === "CANCELLED";

  const tabs = [
    { href: `/organizer/events/${id}`, label: "Overview", active: true },
    { href: `/organizer/events/${id}/tickets`, label: "Tickets", active: false },
    { href: `/organizer/events/${id}/attendees`, label: "Attendees", active: false },
    { href: `/organizer/events/${id}/check-in`, label: "Check-in", active: false },
    { href: `/organizer/events/${id}/staff`, label: "Staff", active: false },
  ];

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">
            <Link href="/organizer" className="link">Organizer</Link> / Event
          </p>
          <h1 className="display-l mt-3">{event.title}</h1>
          <p className="mt-2 text-sm muted">
            {event.category} / {event.venue.name} / {event.timezone.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${event.status === "PUBLISHED" ? "chip-dark" : cancelled ? "chip-accent" : "chip-outline"}`}>
            {event.status}
          </span>
          {event.status === "PUBLISHED" ? (
            <Link href={`/events/${event.slug}`} className="btn btn-sm">Public page</Link>
          ) : null}
        </div>
      </div>

      <nav aria-label="Event sections" className="mt-4 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`btn btn-sm ${tab.active ? "btn-primary" : "btn-ghost"}`}
            aria-current={tab.active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {cancelled ? (
        <div className="notice notice-error mt-6">
          <p className="text-lg">This event is cancelled.</p>
          <p className="mt-2 text-sm">
            Every issued ticket is void. Pending holds were released. The record stays for the audit
            history and cannot be republished.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["Capacity", capacity],
          ["Sold", sold],
          ["Held", held],
          ["Remaining", Math.max(0, capacity - sold - held)],
          ["Reservations", totals.confirmed],
          ["Checked in", desk.checkedIn],
        ].map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="eyebrow">{label}</p>
            <p className="mt-1 mono text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Publication</p>
                <h2 className="display-m mt-2">
                  {event.status === "PUBLISHED" ? "Live on the public programme" : event.status === "DRAFT" ? "Draft, not public" : "Cancelled"}
                </h2>
              </div>
              {!cancelled ? (
                event.status === "PUBLISHED" ? (
                  <ActionForm action={unpublishEventAction} submitLabel="Return to draft" variant="outline">
                    <input type="hidden" name="eventId" value={event.id} />
                  </ActionForm>
                ) : (
                  <ActionForm action={publishEventAction} submitLabel="Publish event" variant="primary">
                    <input type="hidden" name="eventId" value={event.id} />
                  </ActionForm>
                )
              ) : null}
            </div>
            <p className="mt-3 text-sm muted">
              {event.status === "PUBLISHED"
                ? "Unpublishing is only allowed while no hold or confirmed reservation exists. If tickets have been sold, cancel the event instead."
                : "Publishing requires at least one upcoming occurrence and one active ticket type with capacity."}
            </p>
            <p className="mt-2 text-xs faint">
              Minimum ticket price: {event.ticketTypes.length === 0 ? "not configured" : minPrice === 0 ? "Free" : formatMoney(minPrice, currency)}
            </p>
          </section>

          <section className="card p-5">
            <p className="eyebrow">Occurrences and inventory</p>
            <div className="mt-4 space-y-4">
              {event.occurrences.map((occurrence) => (
                <div key={occurrence.id} className="border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {formatDateTime(occurrence.startsAt, event.timezone)}
                      {occurrence.label ? ` / ${occurrence.label}` : ""}
                    </p>
                    <span className={`chip ${occurrence.status === "CANCELLED" ? "chip-accent" : "chip-outline"}`}>
                      {occurrence.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {occurrence.inventories.length === 0 ? (
                      <p className="text-xs faint">No ticket types configured.</p>
                    ) : (
                      occurrence.inventories.map((row) => (
                        <div key={row.id} className="border border-line bg-paper p-2">
                          <p className="text-xs font-medium">{row.ticketType.label}</p>
                          <p className="mono mt-1 text-[0.7rem] faint">
                            {row.sold} sold / {row.held} held / {row.capacity} capacity
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Link href={`/organizer/events/${event.id}/tickets`} className="btn btn-sm mt-4">
              Configure tickets and capacity
            </Link>
          </section>

          <section className="card p-5">
            <p className="eyebrow">Event details</p>
            {cancelled ? (
              <p className="mt-3 text-sm muted">Cancelled events cannot be edited.</p>
            ) : (
              <div className="mt-4">
                <EventEditForm
                  eventId={event.id}
                  initial={{
                    title: event.title,
                    description: event.description,
                    category: event.category,
                    artwork: event.artwork,
                    accessibility: event.venue.accessibility,
                  }}
                />
              </div>
            )}
          </section>

          {!cancelled ? (
            <section className="card border-2 border-accent-ink p-5">
              <p className="eyebrow" style={{ color: "var(--accent-ink)" }}>Cancellation</p>
              <h2 className="display-m mt-2">Cancel the event</h2>
              <p className="mt-2 text-sm muted">
                Cancelling blocks new holds, releases pending holds, voids every issued ticket, and
                releases sold inventory. The reservation and ticket history is retained.
              </p>
              <ActionForm action={cancelEventAction} submitLabel="Cancel event" variant="danger" className="mt-4">
                <input type="hidden" name="eventId" value={event.id} />
                <label className="label" htmlFor="cancel-reason">Reason for the record</label>
                <input
                  id="cancel-reason"
                  name="reason"
                  className="input"
                  maxLength={300}
                  placeholder="Venue lost power for the week."
                />
                <label className="mt-3 flex items-start gap-2 text-sm muted">
                  <input type="checkbox" required className="mt-1" />
                  <span>I understand this voids every issued ticket and cannot be undone.</span>
                </label>
              </ActionForm>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow">At a glance</p>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="faint">Buyer reservations</dt>
                <dd className="mono">{totals.confirmed}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="faint">Pending holds</dt>
                <dd className="mono">{totals.pending}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="faint">Tickets issued</dt>
                <dd className="mono">{desk.issued}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="faint">Checked in</dt>
                <dd className="mono">{desk.checkedIn}</dd>
              </div>
            </dl>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Desk shortcuts</p>
            <div className="mt-3 grid gap-2">
              <Link href={`/organizer/events/${event.id}/attendees`} className="btn btn-sm">Attendees</Link>
              <Link href={`/organizer/events/${event.id}/check-in`} className="btn btn-primary btn-sm">Open check-in</Link>
              <Link href={`/organizer/events/${event.id}/tickets`} className="btn btn-sm">Tickets</Link>
            </div>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Venue</p>
            <p className="mt-2 text-sm">{event.venue.name}</p>
            <p className="text-xs faint">{event.venue.address}</p>
            <p className="mt-3 text-xs muted">{event.venue.accessibility || "No accessibility notes."}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
