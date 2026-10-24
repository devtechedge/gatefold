import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms that apply to the Gatefold demo, reservations, tickets, and the organizer desk.",
};

export default function TermsPage() {
  return (
    <div className="shell-narrow py-12 sm:py-16 prose-block">
      <p className="eyebrow">Policy</p>
      <h1 className="display-l mt-3">Terms of use</h1>
      <p className="lede mt-4">
        Gatefold is a demonstration of event publishing, ticket inventory, issuance, and check-in.
        These terms describe what the demo does and does not promise.
      </p>

      <h2 className="display-m">1. The demo is not a payment service</h2>
      <p className="muted">
        Checkout is explicitly simulated. No card details are requested, no payment provider is
        connected, no money is collected, and no refund can be processed. A demo confirmation is a
        record of a simulated checkout, not proof of payment.
      </p>

      <h2 className="display-m">2. Holds, confirmations, and inventory</h2>
      <p className="muted">
        A reservation begins as a ten-minute hold. The hold reserves inventory at the moment it is
        created. If the timer ends, the seats are released and the hold cannot be confirmed. When a
        hold is confirmed, inventory moves from held to sold and one ticket is issued per confirmed
        quantity. Repeating an identical confirmation returns the same tickets; it does not issue
        more.
      </p>

      <h2 className="display-m">3. Tickets and check-in</h2>
      <p className="muted">
        A ticket is valid only while its reservation is confirmed, its event is published, its
        occurrence is scheduled, and the ticket has not been voided. Each ticket admits one person
        once. A second scan returns the time of the first check-in and does not create another
        record. Signed QR payloads and manual codes are both checked against the database.
      </p>

      <h2 className="display-m">4. Cancellations</h2>
      <p className="muted">
        A buyer can cancel a pending hold at any time. A confirmed reservation can be cancelled by
        the buyer until 24 hours before the first occurrence. Organizers can cancel a reservation or
        an entire event. Cancelling an event voids every issued ticket and releases the associated
        inventory. Reservation and ticket history is retained for the audit record.
      </p>

      <h2 className="display-m">5. Accounts and access</h2>
      <p className="muted">
        Organizer access is scoped to an organizer membership. Owners manage settings and the team,
        managers manage events and tickets, and check-in staff can verify tickets and look up
        attendees without access to pricing, team management, or event cancellation. Do not share
        accounts. Reservation and ticket links are bearer credentials and should be treated like
        tickets.
      </p>

      <h2 className="display-m">6. No real events, no warranty</h2>
      <p className="muted">
        Every event, venue, attendee, and organizer in the seeded demo is fictional. The service is
        provided as a demo without warranties of availability, fitness for a particular purpose, or
        data durability. Do not use it as the only record for a real event.
      </p>

      <h2 className="display-m">7. Changes</h2>
      <p className="muted">
        The demo may be reset, and its data may be replaced without notice. These terms may change as
        the software changes.
      </p>

      <p className="mt-10 border-t border-line pt-5 text-sm faint">
        Questions about these terms belong with the organizer running this Gatefold instance.{" "}
        <Link href="/privacy" className="link">Read the privacy note</Link>.
      </p>
    </div>
  );
}
