import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { requireMembershipForPage } from "@/lib/auth/organizer";
import { ActionForm } from "@/components/action-form";
import { createOrganizerAction } from "@/app/organizer/actions";

export const metadata: Metadata = { title: "Create an organizer", robots: { index: false } };

export default async function NewOrganizerPage() {
  const user = await requirePageUser("/organizer/new");
  const membership = await requireMembershipForPage(user.id);
  if (membership) redirect("/organizer");

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="max-w-2xl">
        <p className="eyebrow">One more step</p>
        <h1 className="display-l mt-3">Name the organizer.</h1>
        <p className="lede mt-4">
          An organizer owns the events, the team, and the audit history. The name appears on public
          event pages. You can rename it later in settings.
        </p>
        <div className="card-hard mt-8 p-6">
          <ActionForm action={createOrganizerAction} submitLabel="Create organizer" buttonFull>
            <label className="label" htmlFor="organizer-name">Organizer name</label>
            <input
              id="organizer-name"
              name="name"
              className="input"
              required
              minLength={2}
              maxLength={100}
              placeholder="Fold & Field"
              autoFocus
            />
            <p className="hint">A public slug is generated from this name.</p>
          </ActionForm>
        </div>
        <p className="mt-6 text-sm faint">
          You are signed in as {user.email}. This demo does not send email, so keep access to this
          account for the demo period.
        </p>
      </div>
    </div>
  );
}
