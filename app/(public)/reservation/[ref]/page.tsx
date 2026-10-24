import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelReservation } from "@/components/cancel-reservation";
import { CopyLink } from "@/components/copy-link";
import { findReservationByRef } from "@/services/reservations";
import { env } from "@/lib/env";
import { formatDateTime, formatMoney } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Reservation",
  robots: { index: false, follow: false },
};

const STATE_LABEL: Record<string, string> = {
  PENDING_HOLD: "Hold open",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export default async function ReservationPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const reservation = await findReservationByRef(ref);
  if (!reservation) notFound();

  const state = reservation.state;
  const confirmed = state === "CONFIRMED";
  const open = state === "PENDING_HOLD";
  const firstLine = reservation.lines[0];
  const link = `${env.siteUrl}/reservation/${ref}`;

  return (
    <div className="shell py-10 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">Reservation</p>
          <h1 className="display-l mt-3">{reservation.event.title}</h1>
          <p className="mt-3 text-sm muted">
            {reservation.event.venueName} / {firstLine ? formatDateTime(firstLine.startsAt, reservation.event.timezone) : ""}
          </p>
        </div>
        <div className="text-right">
          <span className={`chip ${confirmed ? "chip-dark" : state === "PENDING_HOLD" ? "chip-accent" : "chip-outline"}`}>
            {STATE_LABEL[state] ?? state}
          </span>
          <p className="mt-2 mono text-xs faint">{reservation.demoConfirmed ? "Demo confirmation recorded" : "No payment collected"}</p>
        </div>
      </div>

      {state === "CANCELLED" || state === "EXPIRED" ? (
        <div className="notice notice-error mt-6">
          <p className="text-lg">
            {state === "EXPIRED" ? "This reservation expired." : "This reservation was cancelled."}
          </p>
          <p className="mt-2 text-sm">
            {state === "EXPIRED"
              ? "The ten-minute hold ended before checkout. The seats were released."
              : "The tickets on this reservation are void. No money was collected in this demo."}
          </p>
          <Link href={`/events/${reservation.event.slug}`} className="link mt-3 inline-block">
            Return to the event
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5" aria-labelledby="reservation-lines">
            <h2 id="reservation-lines" className="eyebrow">Tickets</h2>
            <div className="table-wrap mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Date</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.label}</td>
                      <td className="text-sm">{formatDateTime(line.startsAt, reservation.event.timezone)}</td>
                      <td className="mono">{line.quantity}</td>
                      <td className="mono">{formatMoney(line.unitPriceMinor * line.quantity, reservation.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
              <span className="eyebrow">Demo total</span>
              <span className="mono text-xl">{formatMoney(reservation.totalMinor, reservation.currency)}</span>
            </div>
          </section>

          {confirmed ? (
            <section className="card p-5" aria-labelledby="reservation-tickets">
              <h2 id="reservation-tickets" className="eyebrow">Issued tickets</h2>
              <p className="mt-2 text-sm muted">
                Each ticket below has its own signed QR code. Open one on the day, or print it.
              </p>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {reservation.tickets.map((ticket) => (
                  <li key={ticket.publicId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{ticket.attendeeName}</p>
                      <p className="mono text-xs faint">{ticket.publicId}</p>
                    </div>
                    <span className={`chip ${ticket.status === "VALID" ? "" : "chip-accent"}`}>{ticket.status}</span>
                    <Link href={`/ticket/${ticket.publicId}`} className="btn btn-sm">
                      Open ticket
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {open ? (
            <section className="card-hard p-5">
              <p className="eyebrow">Next step</p>
              <h2 className="display-m mt-2">Finish the demo checkout</h2>
              <p className="mt-2 text-sm muted">
                The hold is open until {formatDateTime(reservation.holdExpiresAt, reservation.event.timezone)}.
                Confirming issues tickets immediately.
              </p>
              <Link href={`/checkout/${ref}`} className="btn btn-primary mt-4">
                Continue to checkout
              </Link>
            </section>
          ) : null}

          <section className="card p-5">
            <p className="eyebrow">Buyer</p>
            <p className="mt-2 text-sm">{reservation.buyerName}</p>
            <p className="text-sm faint">{reservation.buyerEmail}</p>
            <p className="mt-4 eyebrow">Booked</p>
            <p className="mt-1 text-sm">{formatDateTime(reservation.createdAt, reservation.event.timezone)}</p>
            {reservation.cancelledAt ? (
              <>
                <p className="mt-4 eyebrow">Cancelled</p>
                <p className="mt-1 text-sm">{formatDateTime(reservation.cancelledAt, reservation.event.timezone)}</p>
              </>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <div className="card p-5 lg:sticky lg:top-24">
            <p className="eyebrow">This link is the key</p>
            <p className="mt-2 text-sm muted">
              Gatefold does not send email in this demo. Save this page or copy the link. Anyone with
              the link can view the reservation, so treat it like a ticket.
            </p>
            <div className="mt-4 break-all border border-line bg-paper p-3 mono text-xs">{link}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyLink value={link} />
              <Link href={`/events/${reservation.event.slug}`} className="btn btn-ghost btn-sm">
                Event page
              </Link>
            </div>
            {state === "PENDING_HOLD" || state === "CONFIRMED" ? (
              <div className="mt-5 border-t border-line pt-4">
                <CancelReservation refId={ref} />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
