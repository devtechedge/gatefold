import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { currentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Gatefold organizer desk.",
};

function safeNext(value: string | string[] | undefined): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/organizer";
  return next;
}

export default async function LoginPage({
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
          <p className="eyebrow">Organizer access</p>
          <h1 className="display-l mt-3">Sign in to the desk.</h1>
          <p className="lede mt-4">
            Publishing, inventory, attendees, and the door. Access is scoped to an organizer
            membership and a role.
          </p>
          <div className="mt-8">
            <LoginForm next={next} />
          </div>
        </div>
        <aside className="card-hard self-start p-6">
          <p className="eyebrow">Demo accounts</p>
          <p className="mt-3 text-sm muted">
            These accounts exist only in the seeded demo. Do not reuse their passwords anywhere.
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="mono text-xs uppercase tracking-[0.08em]">Owner</dt>
              <dd className="mt-1">demo@gatefold.test / demo-password-1</dd>
            </div>
            <div>
              <dt className="mono text-xs uppercase tracking-[0.08em]">Event manager</dt>
              <dd className="mt-1">manager@gatefold.test / demo-password-1</dd>
            </div>
            <div>
              <dt className="mono text-xs uppercase tracking-[0.08em]">Check-in staff</dt>
              <dd className="mt-1">staff@gatefold.test / demo-password-1</dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-xs faint">
              The owner can configure events and teams. The manager can run events and tickets. The
              check-in account can verify tickets but cannot see pricing, buyer lists, or team
              settings.
            </p>
          </div>
          <p className="mt-5 text-xs faint">
            No email is sent in this demo. A password reset workflow is not enabled.{" "}
            <Link href="/register" className="link">Create a new account</Link> if you need one.
          </p>
        </aside>
      </div>
    </div>
  );
}
