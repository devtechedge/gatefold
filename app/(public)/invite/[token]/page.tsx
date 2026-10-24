import type { Metadata } from "next";
import Link from "next/link";
import { acceptInviteAction } from "@/app/invite-actions";
import { logoutAction } from "@/app/actions";
import { invitationByToken, invitationIsUsable } from "@/services/auth";
import { currentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Team invitation",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const invitation = await invitationByToken(token);
  const valid = invitation ? invitationIsUsable(invitation) : false;
  const user = await currentUser();
  const error = typeof query.error === "string" ? query.error : null;

  if (!invitation || !valid) {
    return (
      <div className="shell-narrow py-16">
        <p className="eyebrow">Invitation</p>
        <h1 className="display-l mt-3">This invitation is no longer valid.</h1>
        <p className="lede mt-4">
          It may have expired, been accepted already, or been revoked by the organizer. Ask the team
          owner for a new link.
        </p>
        <Link href="/login" className="btn btn-primary mt-6">Sign in</Link>
      </div>
    );
  }

  const next = `/invite/${token}`;
  const emailMatches = user && user.email === invitation.email;

  return (
    <div className="shell-narrow py-16">
      <p className="eyebrow">Team invitation</p>
      <h1 className="display-l mt-3">Join {invitation.organizer.name}.</h1>
      <p className="lede mt-4">
        You have been invited as {invitation.role === "MANAGER" ? "an event manager" : "check-in staff"}.
        The link is for {invitation.email} and expires {formatDateTime(invitation.expiresAt, "UTC")} UTC.
      </p>

      {error ? <p role="alert" className="notice notice-error mt-6">{error}</p> : null}

      {!user ? (
        <div className="card-hard mt-8 p-6">
          <p className="eyebrow">One more step</p>
          <p className="mt-2 text-sm muted">
            Sign in or create an account with {invitation.email}, then open this link again.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary">Sign in</Link>
            <Link href={`/register?next=${encodeURIComponent(next)}`} className="btn">Create an account</Link>
          </div>
        </div>
      ) : emailMatches ? (
        <form action={acceptInviteAction.bind(null, token)} className="card-hard mt-8 p-6">
          <p className="eyebrow">Signed in as {user.email}</p>
          <p className="mt-2 text-sm muted">
            Accepting adds this organizer membership to your account. You can be removed later by the
            organizer owner.
          </p>
          <button type="submit" className="btn btn-primary mt-4">Accept invitation</button>
        </form>
      ) : (
        <div className="card-hard mt-8 p-6">
          <p className="eyebrow">Wrong account</p>
          <p className="mt-2 text-sm muted">
            You are signed in as {user.email}, but this invitation is for {invitation.email}. Sign out
            and use the invited address.
          </p>
          <form action={logoutAction} className="mt-4">
            <button type="submit" className="btn">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
