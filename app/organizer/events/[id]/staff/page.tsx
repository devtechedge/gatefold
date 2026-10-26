import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { eventAccess } from "@/lib/auth/organizer";
import { eventForOrganizer } from "@/repositories/events";
import { eventStaff } from "@/services/events";
import { ActionForm } from "@/components/action-form";
import { setEventStaffAction } from "@/app/organizer/actions";

export const metadata: Metadata = { title: "Event staff", robots: { index: false } };

export default async function EventStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/organizer/events/${id}/staff`);
  const access = await eventAccess(user.id, id, "event:manage").catch(() => null);
  if (!access) {
    const base = await eventAccess(user.id, id, "checkin:perform").catch(() => null);
    if (base?.role === "CHECKIN") redirect(`/organizer/events/${id}/check-in`);
    notFound();
  }
  const event = await eventForOrganizer(id);
  if (!event) notFound();
  const staff = await eventStaff(id, access.event.organizerId);

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="border-b-2 border-ink pb-6">
        <p className="eyebrow">
          <Link href={`/organizer/events/${id}`} className="link">{event.title}</Link> / Staff
        </p>
        <h1 className="display-l mt-3">Door assignments.</h1>
        <p className="mt-3 text-sm muted">
          Check-in staff only reach events assigned to them. Owners and managers can reach every
          event in the organizer.
        </p>
      </div>

      <nav aria-label="Event sections" className="mt-4 flex flex-wrap gap-1">
        <Link href={`/organizer/events/${id}`} className="btn btn-sm btn-ghost">Overview</Link>
        <Link href={`/organizer/events/${id}/tickets`} className="btn btn-sm btn-ghost">Tickets</Link>
        <Link href={`/organizer/events/${id}/attendees`} className="btn btn-sm btn-ghost">Attendees</Link>
        <Link href={`/organizer/events/${id}/check-in`} className="btn btn-sm btn-ghost">Check-in</Link>
        <Link href={`/organizer/events/${id}/staff`} className="btn btn-sm btn-primary" aria-current="page">Staff</Link>
      </nav>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card min-w-0 p-5">
          <p className="eyebrow">Check-in staff</p>
          {staff.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm muted">No check-in staff on this organizer yet.</p>
              <Link href="/organizer/team" className="btn btn-sm mt-3">Invite staff</Link>
            </div>
          ) : (
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Assigned</th>
                    <th scope="col"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <p className="font-medium">{member.displayName}</p>
                        <p className="text-xs faint">{member.email}</p>
                      </td>
                      <td><span className={`chip ${member.assigned ? "chip-dark" : "chip-outline"}`}>{member.assigned ? "Assigned" : "Not assigned"}</span></td>
                      <td>
                        <ActionForm
                          action={setEventStaffAction}
                          submitLabel={member.assigned ? "Remove" : "Assign"}
                          variant={member.assigned ? "danger" : "outline"}
                          buttonClassName="btn-sm"
                        >
                          <input type="hidden" name="eventId" value={id} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <input type="hidden" name="assigned" value={member.assigned ? "false" : "true"} />
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow">How it works</p>
            <p className="mt-2 text-sm muted">
              Assignment is per event. A check-in account cannot open the attendee list, pricing,
              or check-in page for an event it is not assigned to.
            </p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Team</p>
            <p className="mt-2 text-sm muted">Invite or remove check-in staff in the team screen.</p>
            <Link href="/organizer/team" className="btn btn-sm mt-3 w-full">Open team</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
