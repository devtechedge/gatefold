import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/domain/permissions";
import { ActionForm } from "@/components/action-form";
import { deleteAccountAction } from "@/app/organizer/actions";
import { logoutAction } from "@/app/actions";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requirePageUser("/organizer/account");
  const [memberships, ownedOrganizers] = await Promise.all([
    prisma.organizerMembership.findMany({
      where: { userId: user.id },
      include: { organizer: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organizer.count({ where: { ownerId: user.id } }),
  ]);

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="border-b-2 border-ink pb-6">
        <p className="eyebrow">Account</p>
        <h1 className="display-l mt-3">{user.displayName}</h1>
        <p className="mt-3 text-sm muted">{user.email}</p>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          <section className="card p-5">
            <p className="eyebrow">Memberships</p>
            {memberships.length === 0 ? (
              <p className="mt-3 text-sm muted">No organizer membership yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {memberships.map((membership) => (
                  <li key={membership.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm">{membership.organizer.name}</p>
                      <p className="mono text-xs faint">{membership.organizer.slug}</p>
                    </div>
                    <span className="chip">{ROLE_LABELS[membership.role as Role]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card border-2 border-accent-ink p-5">
            <p className="eyebrow" style={{ color: "var(--accent-ink)" }}>Delete account</p>
            <h2 className="display-m mt-2">Remove this account</h2>
            {ownedOrganizers > 0 ? (
              <p className="mt-3 text-sm muted">
                This account still owns an organizer. Deleting it would orphan events, tickets, and
                audit history, so deletion is blocked while you are an organizer owner. The demo does
                not implement ownership transfer.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm muted">
                  Deletion revokes every session, removes organizer memberships, and replaces the
                  name, email, and password with anonymized values. Check-in and audit records stay
                  attached to the anonymized account so operational history is not corrupted.
                </p>
                <div className="mt-4">
                  <ActionForm action={deleteAccountAction} submitLabel="Delete my account" variant="danger">
                    <label className="flex items-start gap-2 text-sm muted">
                      <input type="checkbox" required className="mt-1" />
                      <span>I understand this cannot be undone.</span>
                    </label>
                  </ActionForm>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow">Session</p>
            <p className="mt-2 text-sm muted">
              Signing out revokes the current session cookie. Other sessions stay valid until they
              expire or are revoked by a password change.
            </p>
            <form action={logoutAction} className="mt-4">
              <button type="submit" className="btn w-full">Sign out</button>
            </form>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Policy</p>
            <p className="mt-2 text-sm muted">
              The privacy note describes what is stored and what deletion does.
            </p>
            <Link href="/privacy" className="link mt-3 inline-block text-sm">Read the privacy note</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
