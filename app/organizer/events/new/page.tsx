import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { requireMembershipForPage } from "@/lib/auth/organizer";
import { can, type Role } from "@/domain/permissions";
import { EventCreateForm } from "@/components/organizer/event-create-form";
import { defaultOccurrenceInputs } from "@/lib/dates";

export const metadata: Metadata = { title: "New event", robots: { index: false } };

export default async function NewEventPage() {
  const user = await requirePageUser("/organizer/events/new");
  const membership = await requireMembershipForPage(user.id);
  if (!membership) redirect("/organizer/new");
  if (!can(membership.role as Role, "event:manage")) redirect("/organizer");

  return (
    <div className="p-5 sm:p-8 lg:p-10">
      <div className="border-b-2 border-ink pb-6">
        <p className="eyebrow">New event / {membership.organizer.name}</p>
        <h1 className="display-l mt-3">Build the programme.</h1>
        <p className="lede mt-4">
          Start with the event and its dates. Ticket types and capacity come next, and nothing is
          public until you publish.
        </p>
      </div>
      <div className="mt-8">
        <EventCreateForm defaultOccurrence={defaultOccurrenceInputs()} />
      </div>
      <p className="mt-8 text-sm faint">
        <Link href="/organizer" className="link">Back to overview</Link>
      </p>
    </div>
  );
}
