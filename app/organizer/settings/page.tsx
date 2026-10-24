import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { requireMembershipForPage } from "@/lib/auth/organizer";
import { can, ROLE_LABELS, type Role } from "@/domain/permissions";
import { prisma } from "@/lib/db";
import { OrganizerSettingsForm } from "@/components/organizer/settings-form";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Organizer settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await requirePageUser("/organizer/settings");
  const membership = await requireMembershipForPage(user.id);
  if (!membership) redirect("/organizer/new");
  const role = membership.role as Role;
  if (!can(role, "organizer:manage")) redirect("/organizer");
  const venues = await prisma.venue.findMany({
    where: { organizerId: membership.organizerId },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { _count: { select: { events: true } } },
  });

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="border-b-2 border-ink pb-6">
        <p className="eyebrow">Settings / {membership.organizer.name}</p>
        <h1 className="display-l mt-3">Organizer settings.</h1>
        <p className="mt-3 text-sm muted">
          Owner-only. Team roles and invitations live in the team screen.
        </p>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-5">
          <p className="eyebrow">Identity</p>
          <div className="mt-4 max-w-lg">
            <OrganizerSettingsForm initialName={membership.organizer.name} />
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <p className="eyebrow">Public slug</p>
            <p className="mono mt-1 text-sm">{membership.organizer.slug}</p>
            <p className="mt-1 text-xs faint">
              The slug is generated at creation and kept stable so links do not break.
            </p>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow">Account</p>
            <p className="mt-2 text-sm">{user.displayName}</p>
            <p className="text-xs faint">{user.email}</p>
            <p className="mt-2 chip chip-outline">{ROLE_LABELS[role]}</p>
            <Link href="/organizer/account" className="btn btn-sm mt-4 w-full">Manage account</Link>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Venues</p>
            <p className="mt-2 text-xs faint">
              Venues are captured with each event. These are the records currently attached to this
              organizer.
            </p>
            <ul className="mt-3 space-y-3">
              {venues.length === 0 ? (
                <li className="text-sm muted">No venue yet.</li>
              ) : (
                venues.map((venue) => (
                  <li key={venue.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                    <p className="text-sm">{venue.name}</p>
                    <p className="text-xs faint">{venue.address}</p>
                    <p className="mt-1 text-[0.65rem] faint">
                      {venue.timezone} / {venue._count.events} event{venue._count.events === 1 ? "" : "s"}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Created</p>
            <p className="mt-2 text-sm">{formatDateTime(membership.organizer.createdAt, "UTC")} UTC</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
