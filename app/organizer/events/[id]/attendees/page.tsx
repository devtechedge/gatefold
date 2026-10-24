import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { eventAccess } from "@/lib/auth/organizer";
import { searchAttendees, attendeeTotals } from "@/services/attendees";
import { ActionForm } from "@/components/action-form";
import { cancelReservationAction } from "@/app/organizer/actions";
import { formatDateTime, formatMoney } from "@/lib/dates";

export const metadata: Metadata = { title: "Attendees", robots: { index: false } };

const STATE_OPTIONS = ["ALL", "PENDING_HOLD", "CONFIRMED", "CANCELLED", "EXPIRED"] as const;

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requirePageUser(`/organizer/events/${id}/attendees`);
  const access = await eventAccess(user.id, id, "attendee:read").catch(() => null);
  if (!access) {
    const base = await eventAccess(user.id, id, "checkin:perform").catch(() => null);
    if (base?.role === "CHECKIN") redirect(`/organizer/events/${id}/check-in`);
    notFound();
  }

  const q = typeof query.q === "string" ? query.q : "";
  const rawState = typeof query.state === "string" ? query.state : "ALL";
  const state = STATE_OPTIONS.includes(rawState as (typeof STATE_OPTIONS)[number])
    ? (rawState as (typeof STATE_OPTIONS)[number])
    : "ALL";
  const offsetRaw = Number.parseInt(typeof query.cursor === "string" ? query.cursor : "0", 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
  const take = 25;

  const [{ rows, hasMore }, totals] = await Promise.all([
    searchAttendees(id, { q, state, offset, take }),
    attendeeTotals(id),
  ]);

  function href(next: { q?: string; state?: string; cursor?: number }) {
    const params = new URLSearchParams();
    const nextQ = next.q ?? q;
    const nextState = next.state ?? state;
    if (nextQ) params.set("q", nextQ);
    if (nextState !== "ALL") params.set("state", nextState);
    if (next.cursor) params.set("cursor", String(next.cursor));
    const suffix = params.toString();
    return suffix ? `/organizer/events/${id}/attendees?${suffix}` : `/organizer/events/${id}/attendees`;
  }

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">
            <Link href={`/organizer/events/${id}`} className="link">Event</Link> / Attendees
          </p>
          <h1 className="display-l mt-3">Attendees and reservations.</h1>
          <p className="mt-3 text-sm muted">
            Buyer contact details are visible to managers and owners only. Check-in staff use a
            narrower lookup on the door console.
          </p>
        </div>
        <Link href={`/organizer/events/${id}/check-in`} className="btn btn-primary">Open check-in</Link>
      </div>

      <nav aria-label="Event sections" className="mt-4 flex flex-wrap gap-1">
        <Link href={`/organizer/events/${id}`} className="btn btn-sm btn-ghost">Overview</Link>
        <Link href={`/organizer/events/${id}/tickets`} className="btn btn-sm btn-ghost">Tickets</Link>
        <Link href={`/organizer/events/${id}/attendees`} className="btn btn-sm btn-primary" aria-current="page">Attendees</Link>
        <Link href={`/organizer/events/${id}/check-in`} className="btn btn-sm btn-ghost">Check-in</Link>
      </nav>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Confirmed", totals.confirmed],
          ["Pending holds", totals.pending],
          ["Tickets issued", totals.issued],
          ["Checked in", totals.checkedIn],
        ].map(([label, value]) => (
          <div key={label} className="card p-3">
            <p className="eyebrow">{label}</p>
            <p className="mt-1 mono text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <form action={`/organizer/events/${id}/attendees`} method="get" className="card mt-6 p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <div>
            <label className="label" htmlFor="attendee-q">Search</label>
            <input
              id="attendee-q"
              name="q"
              defaultValue={q}
              className="input"
              placeholder="Name, email, or ticket code"
              maxLength={120}
            />
          </div>
          <div>
            <label className="label" htmlFor="attendee-state">State</label>
            <select id="attendee-state" name="state" defaultValue={state} className="select">
              {STATE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === "ALL" ? "All states" : option.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">Search</button>
            <Link href={`/organizer/events/${id}/attendees`} className="btn btn-ghost">Clear</Link>
          </div>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-lg">No reservations match this view.</p>
          <p className="mt-2 text-sm muted">Clear the search or wait for the first hold.</p>
        </div>
      ) : (
        <div className="table-wrap mt-6">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Buyer</th>
                <th scope="col">State</th>
                <th scope="col">Tickets</th>
                <th scope="col">Created</th>
                <th scope="col">Demo total</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((reservation) => {
                const tickets = reservation.lines.flatMap((line) => line.tickets);
                const checkedIn = tickets.filter((ticket) => ticket.checkIn).length;
                return (
                  <tr key={reservation.id}>
                    <td>
                      <p className="font-medium">{reservation.buyerName}</p>
                      <p className="text-xs faint">{reservation.buyerEmail}</p>
                      <p className="mono mt-1 text-[0.65rem] faint">{reservation.id.slice(0, 8)}</p>
                    </td>
                    <td><span className="chip">{reservation.state.replace("_", " ")}</span></td>
                    <td className="text-xs">
                      {reservation.lines.map((line) => (
                        <p key={line.id}>{line.ticketType.label} x{line.quantity}</p>
                      ))}
                      <p className="mt-1 faint">{tickets.length} issued / {checkedIn} checked in</p>
                    </td>
                    <td className="text-xs">
                      {formatDateTime(reservation.createdAt, "UTC")}
                      <span className="block faint">UTC</span>
                    </td>
                    <td className="mono">{formatMoney(reservation.totalMinor, reservation.currency)}</td>
                    <td>
                      {reservation.state === "PENDING_HOLD" || reservation.state === "CONFIRMED" ? (
                        <ActionForm
                          action={cancelReservationAction}
                          submitLabel="Cancel"
                          variant="danger"
                          buttonClassName="btn-sm"
                        >
                          <input type="hidden" name="eventId" value={id} />
                          <input type="hidden" name="reservationId" value={reservation.id} />
                          <input type="hidden" name="reason" value="Cancelled by organizer from the attendee list" />
                        </ActionForm>
                      ) : (
                        <span className="text-xs faint">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pagination" className="mt-5 flex items-center justify-between border-t border-line pt-4">
        {offset > 0 ? (
          <Link href={href({ cursor: Math.max(0, offset - take) })} className="btn btn-sm">Previous</Link>
        ) : (
          <span className="mono text-xs faint">First page</span>
        )}
        {hasMore ? (
          <Link href={href({ cursor: offset + take })} className="btn btn-sm">Next page</Link>
        ) : (
          <span className="mono text-xs faint">End of list</span>
        )}
      </nav>
    </div>
  );
}
