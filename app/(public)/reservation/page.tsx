import type { Metadata } from "next";
import Link from "next/link";
import { ReservationFinder } from "@/components/reservation-finder";

export const metadata: Metadata = {
  title: "Find a reservation",
  description: "Open a Gatefold reservation with the link you saved.",
};

export default function ReservationFinderPage() {
  return (
    <div className="shell-narrow py-12 sm:py-16">
      <p className="eyebrow">Retrieve</p>
      <h1 className="display-l mt-3">Find a reservation</h1>
      <p className="lede mt-4">
        Gatefold does not send email in this demo, so there is no inbox to search. The reservation
        link you saved is the key. Paste it below.
      </p>
      <div className="card mt-8 p-6">
        <ReservationFinder />
        <p className="mt-5 border-t border-line pt-4 text-sm muted">
          A reservation link looks like <span className="mono text-xs">/reservation/&lt;id&gt;.&lt;signature&gt;</span>.
          Links are unguessable and can be revoked by cancelling the reservation or by the organizer.
        </p>
      </div>
      <p className="mt-6 text-sm faint">
        Looking for a ticket instead? Open the issued ticket link from the confirmed reservation.{" "}
        <Link href="/events" className="link">Browse events</Link>
      </p>
    </div>
  );
}
