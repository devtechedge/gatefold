import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { requireMembershipForPage } from "@/lib/auth/organizer";
import { can, ROLE_LABELS, type Role } from "@/domain/permissions";
import { listTeam } from "@/services/auth";
import { ActionForm } from "@/components/action-form";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/app/organizer/actions";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Team", robots: { index: false } };

export default async function TeamPage() {
  const user = await requirePageUser("/organizer/team");
  const membership = await requireMembershipForPage(user.id);
  if (!membership) redirect("/organizer/new");
  const role = membership.role as Role;
  if (!can(role, "team:manage")) redirect("/organizer");
  const { members, invitations } = await listTeam(membership.organizerId);

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="border-b-2 border-ink pb-6">
        <p className="eyebrow">Team / {membership.organizer.name}</p>
        <h1 className="display-l mt-3">Who can do what.</h1>
        <p className="mt-3 text-sm muted">
          Owners manage the organizer, team, and billing surface. Event managers run events and
          tickets. Check-in staff verify tickets and look up attendees without buyer-data or pricing
          access.
        </p>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <section className="card p-5">
            <p className="eyebrow">Members</p>
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Role</th>
                    <th scope="col">Joined</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <p className="font-medium">{member.user.displayName}</p>
                        <p className="text-xs faint">{member.user.email}</p>
                      </td>
                      <td>
                        {member.role === "OWNER" ? (
                          <span className="chip chip-dark">Owner</span>
                        ) : (
                          <ActionForm
                            action={updateMemberRoleAction}
                            submitLabel="Update role"
                            variant="outline"
                            buttonClassName="btn-sm"
                          >
                            <input type="hidden" name="membershipId" value={member.id} />
                            <select name="role" defaultValue={member.role} className="select" aria-label={`Role for ${member.user.displayName}`}>
                              <option value="MANAGER">Event manager</option>
                              <option value="CHECKIN">Check-in staff</option>
                            </select>
                          </ActionForm>
                        )}
                      </td>
                      <td className="text-xs">
                        {formatDateTime(member.createdAt, "UTC")}
                        <span className="block faint">UTC</span>
                      </td>
                      <td>
                        {member.role === "OWNER" ? (
                          <span className="text-xs faint">Owner cannot be removed</span>
                        ) : (
                          <ActionForm
                            action={removeMemberAction}
                            submitLabel="Remove"
                            variant="danger"
                            buttonClassName="btn-sm"
                          >
                            <input type="hidden" name="membershipId" value={member.id} />
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5">
            <p className="eyebrow">Pending invitations</p>
            {invitations.length === 0 ? (
              <p className="mt-3 text-sm muted">No pending invitation.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm">{invitation.email}</p>
                      <p className="text-xs faint">
                        {ROLE_LABELS[invitation.role as Role]} / invited by {invitation.invitedBy?.displayName ?? "owner"}
                      </p>
                    </div>
                    <p className="text-xs faint">expires {formatDateTime(invitation.expiresAt, "UTC")} UTC</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs faint">
              Invitation links are stored as hashes, so a link cannot be recovered after creation.
              Create a new invitation to rotate it.
            </p>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="card-hard p-5">
            <p className="eyebrow">Invite someone</p>
            <p className="mt-2 text-sm muted">
              Email delivery is not configured in this demo. The invitation link is shown once after
              creation; send it yourself.
            </p>
            <div className="mt-4">
              <ActionForm action={inviteMemberAction} submitLabel="Create invitation" buttonFull>
                <label className="label" htmlFor="invite-email">Email</label>
                <input id="invite-email" name="email" type="email" className="input" required maxLength={254} />
                <label className="label mt-3" htmlFor="invite-role">Role</label>
                <select id="invite-role" name="role" className="select" defaultValue="CHECKIN">
                  <option value="CHECKIN">Check-in staff</option>
                  <option value="MANAGER">Event manager</option>
                </select>
              </ActionForm>
            </div>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Role matrix</p>
            <ul className="mt-3 space-y-2 text-xs muted">
              <li>Owner: everything, including team and settings.</li>
              <li>Manager: events, publishing, tickets, attendees, check-in.</li>
              <li>Check-in: verification and limited attendee lookup.</li>
            </ul>
            <p className="mt-4 text-xs faint">
              <Link href="/organizer/settings" className="link">Organizer settings</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
