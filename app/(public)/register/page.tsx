import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { currentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Gatefold account and start an organizer.",
};

function safeNext(value: string | string[] | undefined): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/organizer";
  return next;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const user = await currentUser();
  if (user) redirect(next);

  return (
    <div className="shell py-12 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="max-w-md">
          <p className="eyebrow">New organizer</p>
          <h1 className="display-l mt-3">Start with a name.</h1>
          <p className="lede mt-4">
            Create an account first. You will name the organizer and add a venue on the next step.
            Nothing is published until you choose to publish it.
          </p>
          <div className="mt-8">
            <RegisterForm next={next} />
          </div>
        </div>
        <aside className="card-hard self-start p-6">
          <p className="eyebrow">What happens next</p>
          <ol className="mt-4 space-y-3 text-sm muted">
            <li>01 / Name the organizer.</li>
            <li>02 / Create an event and its occurrence.</li>
            <li>03 / Add ticket types and capacity.</li>
            <li>04 / Publish when the room is ready.</li>
            <li>05 / Open the check-in desk on a phone.</li>
          </ol>
          <p className="mt-6 border-t border-line pt-4 text-xs faint">
            Email delivery is not configured in this demo, so account recovery is manual. Use an
            address you can access for the demo period.
          </p>
        </aside>
      </div>
    </div>
  );
}
