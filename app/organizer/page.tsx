import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { requireMembershipForPage } from "@/lib/auth/organizer";
import { organizerDashboard } from "@/services/dashboard";
import { assignedEventIds } from "@/services/events";
import { ROLE_LABELS, type Role } from "@/domain/permissions";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Organizer overview", robots: { index: false } };

const ACTION_LABELS: Record<string, string> = {
  "event.created": "Event created",
  "event.updated": "Event details updated",
  "event.published": "Event published",
  "event.unpublished": "Event returned to draft",
  "event.cancelled": "Event cancelled",
  "ticket_type.created": "Ticket type added",
  "ticket_type.updated": "Ticket type updated",
  "ticket_type.archived": "Ticket type archived",
  "ticket_type.reactivated": "Ticket type reactivated",
  "inventory.capacity_updated": "Capacity updated",
  "reservation.confirmed_demo": "Demo checkout confirmed",
  "reservation.expired": "Hold expired",
  "reservation.cancelled_by_buyer": "Reservation cancelled by buyer",
  "reservation.cancelled_by_organizer": "Reservation cancelled by organizer",
  "ticket.checked_in": "Ticket checked in",
  "team.invited": "Team invitation created",
  "team.invitation_accepted": "Invitation accepted",
  "team.role_updated": "Team role updated",
  "team.member_removed": "Team member removed",
  "organizer.settings_updated": "Organizer settings updated",
};

export default async function OrganizerHomePage() {
  const user = await requirePageUser("/organizer");
  const membership = await requireMembershipForPage(user.id);
  if (!membership) redirect("/organizer/new");
  const role = membership.role as Role;
  const scopedEventIds = role === "CHECKIN" ? await assignedEventIds(user.id, membership.organizerId) : undefined;
  const data = await organizerDashboard(membership.organizerId, scopedEventIds);

  const tasks: { title: string; detail: string; href: string }[] = [];
  if (role === "CHECKIN") {
    const first = data.upcoming[0];
    if (first) {
      tasks.push({
        title: "Your door assignment",
        detail: `Check in attendees for ${first.title}.`,
        href: `/organizer/events/${first.id}/check-in`,
      });
    }
  } else {
    const firstDraft = data.events.find((event) => event.status === "DRAFT");
    if (data.stats.drafts > 0 && firstDraft) {
      tasks.push({
        title: `${data.stats.drafts} draft ${data.stats.drafts === 1 ? "event" : "events"} not published`,
        detail: "Add ticket types, then publish when the room is ready.",
        href: `/organizer/events/${firstDraft.id}`,
      });
    }
    for (const event of data.lowInventory) {
      tasks.push({
        title: `${event.title} has ${event.capacity - event.sold - event.held} tickets left`,
        detail: "Review capacity or expect a sell-out.",
        href: `/organizer/events/${event.id}/tickets`,
      });
    }
    if (data.stats.pendingHolds > 0) {
      tasks.push({
        title: `${data.stats.pendingHolds} ${data.stats.pendingHolds === 1 ? "hold is" : "holds are"} awaiting checkout`,
        detail: "Holds expire after ten minutes and release their seats.",
        href: data.upcoming[0] ? `/organizer/events/${data.upcoming[0].id}/attendees?state=PENDING_HOLD` : "/organizer",
      });
    }
  }

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1 className="display-l mt-3">{membership.organizer.name}</h1>
          <p className="mt-2 text-sm muted">
            {ROLE_LABELS[role]} / {user.displayName} / demo organizer
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {role !== "CHECKIN" ? (
            <Link href="/organizer/events/new" className="btn btn-primary">New event</Link>
          ) : null}
          <Link href="/events" className="btn">View public site</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Published events", data.stats.published],
          ["Tickets sold", data.stats.ticketsSold],
          ["Checked in", data.stats.checkedIn],
          ["Open holds", data.stats.pendingHolds],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="eyebrow">{label}</p>
            <p className="mt-2 mono text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <h2 className="display-m">Upcoming events</h2>
            <span className="eyebrow">{data.upcoming.length} live</span>
          </div>
          {data.upcoming.length === 0 ? (
            <div className="card mt-4 p-6">
              <p className="text-lg">No published event has an upcoming date.</p>
              <p className="mt-2 text-sm muted">Create an event, add tickets, and publish it when the details are ready.</p>
              <Link href="/organizer/events/new" className="btn btn-primary mt-4">Create an event</Link>
            </div>
          ) : (
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Next date</th>
                    <th scope="col">Inventory</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming.map((event) => {
                    const remaining = event.capacity - event.sold - event.held;
                    const percent = event.capacity > 0 ? Math.round((event.sold / event.capacity) * 100) : 0;
                    return (
                      <tr key={event.id}>
                        <td>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-xs faint">{event.category} / {event.ticketTypes} ticket types</p>
                        </td>
                        <td className="text-sm">
                          {event.nextStart ? formatDateTime(event.nextStart, event.timezone) : "No date"}
                        </td>
                        <td className="min-w-[150px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="mono">{event.sold} sold</span>
                            <span className="faint">{remaining} left</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-paper-3" aria-hidden="true">
                            <div className="h-full bg-accent-ink" style={{ width: `${Math.min(100, percent)}%` }} />
                          </div>
                          <p className="mt-1 text-[0.65rem] faint">{event.held} held</p>
                        </td>
                        <td><span className="chip">{event.status}</span></td>
                        <td>
                          <Link href={`/organizer/events/${event.id}`} className="btn btn-sm">Open</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="display-m">All events</h2>
              <span className="eyebrow">{data.events.length} total</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.events.map((event) => (
                <Link
                  key={event.id}
                  href={`/organizer/events/${event.id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-1 text-xs faint">
                      {event.status} / {event.sold} sold / {event.capacity} capacity
                    </p>
                  </div>
                  <span className={`chip ${event.status === "PUBLISHED" ? "chip-dark" : "chip-outline"}`}>
                    {event.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card-hard p-5">
            <p className="eyebrow">Next operational task</p>
            {tasks.length === 0 ? (
              <>
                <p className="mt-3 text-lg">Nothing urgent.</p>
                <p className="mt-2 text-sm muted">
                  The programme is live and no hold is waiting. The door console is ready on a phone.
                </p>
                <Link href={data.upcoming[0] ? `/organizer/events/${data.upcoming[0].id}/check-in` : "/organizer/events/new"} className="btn btn-primary mt-4 w-full">
                  {data.upcoming[0] ? "Open check-in desk" : "Create the first event"}
                </Link>
              </>
            ) : (
              <ul className="mt-3 space-y-3">
                {tasks.map((task) => (
                  <li key={task.title} className="border-l-2 border-accent pl-3">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs faint">{task.detail}</p>
                    <Link href={task.href} className="link mt-1 inline-block text-xs">Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <p className="eyebrow">Recent activity</p>
            {role === "CHECKIN" ? (
              <p className="mt-3 text-sm muted">
                You see events assigned to you. Ask the organizer owner for assignment changes.
              </p>
            ) : data.recentAudit.length === 0 ? (
              <p className="mt-3 text-sm muted">No audit events yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.recentAudit.map((entry) => (
                  <li key={entry.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                    <p className="text-sm">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                    <p className="mt-0.5 text-xs faint">
                      {entry.actor?.displayName ?? "System"} / {formatDateTime(entry.createdAt, "UTC")} UTC
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <p className="eyebrow">Demo boundary</p>
            <p className="mt-2 text-sm muted">
              Checkout records a simulated confirmation. No payment is collected and no email is sent.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
