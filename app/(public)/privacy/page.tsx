import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What the Gatefold demo stores, why, and how access is scoped.",
};

export default function PrivacyPage() {
  return (
    <div className="shell-narrow py-12 sm:py-16 prose-block">
      <p className="eyebrow">Policy</p>
      <h1 className="display-l mt-3">Privacy note</h1>
      <p className="lede mt-4">
        This note describes what the Gatefold demo stores and how it is used. It is written to match
        the code, not to describe a commercial data practice.
      </p>

      <h2 className="display-m">What is stored</h2>
      <ul className="muted">
        <li>Account records: display name, normalized email address, password hash, and timestamps.</li>
        <li>Session records: a hash of the cookie token, expiration, and revocation state.</li>
        <li>Organizer records: organizer name and slug, memberships, roles, invitations, and audit events.</li>
        <li>Event records: titles, descriptions, venues, schedules, ticket types, prices, and capacity.</li>
        <li>Buyer records: the name, email, optional phone number, reservation state, and line totals.</li>
        <li>Ticket records: attendee names, ticket type, issuance time, status, and check-in time.</li>
        <li>Rate-limit records: a hashed or scoped key, a time window, and a counter.</li>
      </ul>

      <h2 className="display-m">How it is used</h2>
      <p className="muted">
        Data is used to publish events, hold and confirm inventory, issue tickets, verify entry,
        enforce role permissions, prevent abuse, and keep an audit history. Gatefold does not send
        email in this demo and does not connect an external analytics or advertising service.
      </p>

      <h2 className="display-m">Cookies and local storage</h2>
      <p className="muted">
        A single HttpOnly session cookie keeps an organizer signed in. The theme preference is stored
        in the browser&apos;s local storage. Reservation and ticket links are not stored in cookies.
      </p>

      <h2 className="display-m">Access and sharing</h2>
      <p className="muted">
        Organizers can see buyer details only for their own events. Check-in staff can verify tickets
        and look up an attendee but cannot browse unrestricted buyer data. Reservation and ticket
        links are bearer credentials, so anyone holding one can view that record. Treat them like
        tickets.
      </p>

      <h2 className="display-m">Retention and deletion</h2>
      <p className="muted">
        The demo may be reset at any time, which replaces the seeded data. Organizer-owned records
        are retained while the organizer exists so that ticket and inventory history stays
        consistent. Staff accounts can be removed from the team. This demo does not yet provide a
        self-serve account deletion control, and a seeded owner account cannot be deleted while it
        owns an organizer. Do not enter real personal data into the demo.
      </p>

      <h2 className="display-m">Infrastructure</h2>
      <p className="muted">
        The application is hosted on Vercel and stores data in a managed PostgreSQL database. Those
        providers process the data on behalf of this demo. No other third-party processor is
        connected.
      </p>

      <p className="mt-10 border-t border-line pt-5 text-sm faint">
        This note is part of the demo documentation and is not legal advice.{" "}
        <Link href="/terms" className="link">Read the terms</Link>.
      </p>
    </div>
  );
}
