import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { eventAccess } from "@/lib/auth/organizer";
import { eventForOrganizer } from "@/repositories/events";
import { checkInStats, recentCheckIns } from "@/services/checkin";
import { CheckInConsole } from "@/components/organizer/checkin-console";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/organizer/events/${id}/check-in`);
  const access = await eventAccess(user.id, id, "checkin:perform").catch(() => null);
  if (!access) notFound();
  const event = await eventForOrganizer(id);
  if (!event) notFound();
  const [stats, recent] = await Promise.all([checkInStats(id), recentCheckIns(id, 12)]);
  const disabled = event.status === "CANCELLED";

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">
            <Link href={`/organizer/events/${id}`} className="link">Event</Link> / Check-in
          </p>
          <h1 className="display-l mt-3">The door.</h1>
          <p className="mt-3 text-sm muted">
            Camera or manual code, both calling the same verification service. The second scan of a
            ticket reports the first scan time and writes nothing.
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Checked in</p>
          <p className="mono text-3xl">{stats.checkedIn}</p>
          <p className="text-xs faint">of {stats.issued} valid tickets</p>
        </div>
      </div>

      <nav aria-label="Event sections" className="mt-4 flex flex-wrap gap-1">
        <Link href={`/organizer/events/${id}`} className="btn btn-sm btn-ghost">Overview</Link>
        {access.role !== "CHECKIN" ? (
          <>
            <Link href={`/organizer/events/${id}/tickets`} className="btn btn-sm btn-ghost">Tickets</Link>
            <Link href={`/organizer/events/${id}/attendees`} className="btn btn-sm btn-ghost">Attendees</Link>
          </>
        ) : null}
        <Link href={`/organizer/events/${id}/check-in`} className="btn btn-sm btn-primary" aria-current="page">Check-in</Link>
      </nav>

      <div className="mt-6">
        <CheckInConsole eventId={event.id} eventTitle={`${event.title} / ${event.venue.name}`} disabled={disabled} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card p-5">
          <p className="eyebrow">Recent check-ins</p>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm muted">No ticket has been checked in yet.</p>
          ) : (
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Attendee</th>
                    <th scope="col">Ticket</th>
                    <th scope="col">Staff</th>
                    <th scope="col">Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono text-xs">{formatDateTime(entry.scannedAt, event.timezone)}</td>
                      <td>{entry.ticket.attendeeName}</td>
                      <td className="text-xs">{entry.ticket.reservationLine.ticketType.label}</td>
                      <td className="text-xs">{entry.staff.displayName}</td>
                      <td className="text-xs">{entry.gateLabel || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow">Door notes</p>
            <ul className="mt-3 space-y-2 text-sm muted">
              <li>Every scan is checked against the ticket, reservation, occurrence, and event state.</li>
              <li>A void ticket, cancelled reservation, wrong event, or cancelled occurrence is refused with a specific reason.</li>
              <li>Manual entry is always available when the camera is unavailable or permission is refused.</li>
              <li>Check-in staff cannot change prices or cancel events.</li>
            </ul>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Venue</p>
            <p className="mt-2 text-sm">{event.venue.name}</p>
            <p className="text-xs faint">{event.venue.address}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
