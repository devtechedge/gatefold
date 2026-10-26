import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { eventAccess } from "@/lib/auth/organizer";
import { can } from "@/domain/permissions";
import { eventForOrganizer } from "@/repositories/events";
import { toDateTimeLocal, formatDateTime, formatMoney } from "@/lib/dates";
import { ActionForm } from "@/components/action-form";
import { TicketAddForm } from "@/components/organizer/ticket-add-form";
import {
  updateCapacityAction,
  setTicketStatusAction,
  setTicketVisibilityAction,
  updateTicketTypeAction,
} from "@/app/organizer/actions";

export const metadata: Metadata = { title: "Tickets", robots: { index: false } };

export default async function TicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/organizer/events/${id}/tickets`);
  const access = await eventAccess(user.id, id, "ticket:manage").catch(() => null);
  if (!access) {
    const base = await eventAccess(user.id, id, "checkin:perform").catch(() => null);
    if (base?.role === "CHECKIN") redirect(`/organizer/events/${id}/check-in`);
    notFound();
  }
  if (!can(access.role, "ticket:manage")) notFound();

  const event = await eventForOrganizer(id);
  if (!event) notFound();
  const cancelled = event.status === "CANCELLED";

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">
            <Link href={`/organizer/events/${id}`} className="link">{event.title}</Link> / Tickets
          </p>
          <h1 className="display-l mt-3">Tickets and capacity.</h1>
          <p className="mt-3 text-sm muted">
            Prices are snapshotted when a hold is created. Changing a price never rewrites an existing
            reservation.
          </p>
        </div>
        <Link href={`/organizer/events/${id}`} className="btn">Back to overview</Link>
      </div>

      <nav aria-label="Event sections" className="mt-4 flex flex-wrap gap-1">
        <Link href={`/organizer/events/${id}`} className="btn btn-sm btn-ghost">Overview</Link>
        <Link href={`/organizer/events/${id}/tickets`} className="btn btn-sm btn-primary" aria-current="page">Tickets</Link>
        <Link href={`/organizer/events/${id}/attendees`} className="btn btn-sm btn-ghost">Attendees</Link>
        <Link href={`/organizer/events/${id}/check-in`} className="btn btn-sm btn-ghost">Check-in</Link>
        <Link href={`/organizer/events/${id}/staff`} className="btn btn-sm btn-ghost">Staff</Link>
      </nav>

      {cancelled ? (
        <div className="notice notice-error mt-6">
          A cancelled event cannot take new ticket types or capacity changes.
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {event.ticketTypes.length === 0 ? (
          <div className="card p-6">
            <p className="text-lg">No ticket types yet.</p>
            <p className="mt-2 text-sm muted">Add one below, then publish the event from the overview.</p>
          </div>
        ) : (
          event.ticketTypes.map((type) => (
            <section key={type.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display-m">{type.label}</h2>
                    <span className={`chip ${type.status === "ACTIVE" ? "" : "chip-outline"}`}>{type.status}</span>
                    <span className={`chip ${type.visibility === "PUBLIC" ? "chip-outline" : "chip-accent"}`}>
                      {type.visibility === "PUBLIC" ? "Public" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm muted">{type.description || "No description."}</p>
                  <p className="mt-2 mono text-sm">
                    {type.priceMinor === 0 ? "Free" : formatMoney(type.priceMinor, type.currency)}
                    <span className="faint"> / {type.currency}</span>
                  </p>
                  <p className="mt-1 text-xs faint">
                    {type.salesStartAt ? `Opens ${formatDateTime(type.salesStartAt, event.timezone)}` : "On sale immediately"}
                    {type.salesEndAt ? ` / closes ${formatDateTime(type.salesEndAt, event.timezone)}` : " / closes at occurrence start"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionForm
                    action={setTicketVisibilityAction}
                    submitLabel={type.visibility === "PUBLIC" ? "Hide from public" : "Show publicly"}
                    variant="outline"
                    buttonClassName="btn-sm"
                  >
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="ticketTypeId" value={type.id} />
                    <input type="hidden" name="visibility" value={type.visibility === "PUBLIC" ? "HIDDEN" : "PUBLIC"} />
                  </ActionForm>
                  <ActionForm
                    action={setTicketStatusAction}
                    submitLabel={type.status === "ACTIVE" ? "Archive" : "Reactivate"}
                    variant="outline"
                    buttonClassName="btn-sm"
                  >
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="ticketTypeId" value={type.id} />
                    <input type="hidden" name="status" value={type.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"} />
                  </ActionForm>
                </div>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <div className="min-w-0">
                  <p className="eyebrow">Capacity by occurrence</p>
                  <div className="mt-3 space-y-2">
                    {event.occurrences.map((occurrence) => {
                      const row = occurrence.inventories.find((inventory) => inventory.ticketTypeId === type.id);
                      if (!row) {
                        return (
                          <p key={occurrence.id} className="text-xs faint">
                            {formatDateTime(occurrence.startsAt, event.timezone)}: inventory missing
                          </p>
                        );
                      }
                      return (
                        <div key={row.id} className="flex flex-wrap items-end justify-between gap-2 border border-line p-2">
                          <div>
                            <p className="text-xs">{formatDateTime(occurrence.startsAt, event.timezone)}</p>
                            <p className="mono mt-1 text-[0.7rem] faint">
                              {row.sold} sold / {row.held} held / {row.capacity} capacity
                            </p>
                          </div>
                          <ActionForm
                            action={updateCapacityAction}
                            submitLabel="Update"
                            variant="outline"
                            buttonClassName="btn-sm"
                          >
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="inventoryId" value={row.id} />
                            <label className="label" htmlFor={`capacity-${row.id}`}>Capacity</label>
                            <input
                              id={`capacity-${row.id}`}
                              name="capacity"
                              type="number"
                              min={row.held + row.sold}
                              max={10000}
                              defaultValue={row.capacity}
                              className="input w-24"
                            />
                          </ActionForm>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs faint">
                    Capacity cannot drop below the number already held or sold.
                  </p>
                </div>

                <details className="border border-line p-3">
                  <summary className="cursor-pointer text-sm">Edit ticket details</summary>
                  <div className="mt-4">
                    <ActionForm action={updateTicketTypeAction} submitLabel="Save ticket type">
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="ticketTypeId" value={type.id} />
                      <label className="label" htmlFor={`label-${type.id}`}>Name</label>
                      <input id={`label-${type.id}`} name="label" className="input" defaultValue={type.label} required maxLength={80} />
                      <label className="label mt-3" htmlFor={`description-${type.id}`}>Description</label>
                      <input id={`description-${type.id}`} name="description" className="input" defaultValue={type.description} maxLength={400} />
                      <label className="label mt-3" htmlFor={`price-${type.id}`}>Price</label>
                      <input id={`price-${type.id}`} name="price" className="input" defaultValue={(type.priceMinor / 100).toFixed(2)} required />
                      <label className="label mt-3" htmlFor={`sales-start-${type.id}`}>Sales open</label>
                      <input
                        id={`sales-start-${type.id}`}
                        name="salesStartLocal"
                        type="datetime-local"
                        className="input"
                        defaultValue={type.salesStartAt ? toDateTimeLocal(type.salesStartAt, event.timezone) : ""}
                      />
                      <label className="label mt-3" htmlFor={`sales-end-${type.id}`}>Sales close</label>
                      <input
                        id={`sales-end-${type.id}`}
                        name="salesEndLocal"
                        type="datetime-local"
                        className="input"
                        defaultValue={type.salesEndAt ? toDateTimeLocal(type.salesEndAt, event.timezone) : ""}
                      />
                    </ActionForm>
                  </div>
                </details>
              </div>
            </section>
          ))
        )}
      </div>

      {!cancelled ? (
        <section className="card mt-10 p-5">
          <p className="eyebrow">Add a ticket type</p>
          <h2 className="display-m mt-2">New ticket type</h2>
          <p className="mt-2 text-sm muted">
            Capacity is per occurrence and per ticket type. The database enforces that held plus sold
            never exceeds it.
          </p>
          <div className="mt-5">
            <TicketAddForm eventId={event.id} occurrenceCount={event.occurrences.length} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
