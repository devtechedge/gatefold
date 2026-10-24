import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutPanel } from "@/components/checkout-panel";
import { findReservationByRef } from "@/services/reservations";
import { formatDateTime, formatMoney } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const reservation = await findReservationByRef(ref);
  if (!reservation) notFound();
  if (reservation.state === "CONFIRMED") redirect(`/reservation/${ref}`);

  const closed =
    reservation.state === "EXPIRED" || reservation.state === "CANCELLED";

  return (
    <div className="shell py-10 sm:py-14">
      <div className="border-b-2 border-ink pb-6">
        <p className="eyebrow">Secure reservation link</p>
        <h1 className="display-l mt-3">Checkout</h1>
        <p className="lede mt-4">
          {reservation.event.title} / {formatDateTime(reservation.lines[0].startsAt, reservation.event.timezone)}
        </p>
        <p className="mt-2 text-sm muted">
          {reservation.event.venueName} / {reservation.event.organizerName}
        </p>
      </div>

      {closed ? (
        <div className="card-hard mt-8 max-w-2xl p-6">
          <p className="eyebrow">Reservation {reservation.state.toLowerCase()}</p>
          <h2 className="display-m mt-3">
            {reservation.state === "EXPIRED" ? "The hold expired." : "The reservation was cancelled."}
          </h2>
          <p className="mt-3 text-sm muted">
            {reservation.state === "EXPIRED"
              ? "Holds last ten minutes. The seats were released back to the event when the timer ended."
              : "The hold was cancelled and its inventory was released."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/events/${reservation.event.slug}`} className="btn btn-primary">
              Back to the event
            </Link>
            <Link href={`/reservation/${ref}`} className="btn">
              View reservation record
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="chip chip-outline">{reservation.lines.reduce((sum, line) => sum + line.quantity, 0)} tickets held</span>
            <span className="chip chip-outline">{formatMoney(reservation.totalMinor, reservation.currency)} demo total</span>
            <span className="eyebrow">Hold expires {formatDateTime(reservation.holdExpiresAt, reservation.event.timezone)}</span>
          </div>
          <div className="mt-8">
            <CheckoutPanel
              refId={ref}
              eventSlug={reservation.event.slug}
              holdExpiresAt={reservation.holdExpiresAt}
              serverNow={new Date().toISOString()}
              lines={reservation.lines.map((line) => ({
                id: line.id,
                label: line.label,
                quantity: line.quantity,
                unitPriceMinor: line.unitPriceMinor,
              }))}
              buyerName={reservation.buyerName}
              buyerEmail={reservation.buyerEmail}
              currency={reservation.currency}
              totalMinor={reservation.totalMinor}
            />
          </div>
        </>
      )}
    </div>
  );
}
