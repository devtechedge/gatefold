import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/print-button";
import { ticketView } from "@/services/checkout";
import { ticketQrPayload } from "@/domain/ticket";
import { formatDateTime, formatMoney, formatTimeRange } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
};

export default async function TicketPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const view = await ticketView(publicId);
  if (!view) notFound();

  const { ticket, occurrence, usable } = view;
  const event = occurrence.event;
  const checkedIn = ticket.checkIn;
  const status = checkedIn
    ? "CHECKED_IN"
    : !usable
      ? ticket.status === "VOID"
        ? "VOID"
        : event.status === "CANCELLED"
          ? "EVENT_CANCELLED"
          : "INACTIVE"
      : "VALID";

  const qrDataUrl =
    status === "VALID"
      ? await QRCode.toDataURL(ticketQrPayload(ticket.publicId), {
          margin: 1,
          width: 360,
          color: { dark: "#17141c", light: "#fbf7ee" },
        })
      : null;

  return (
    <div className="shell py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">Issued ticket</p>
          <h1 className="display-l mt-3">{event.title}</h1>
          <p className="mt-3 text-sm muted">
            {event.venue.name} / {event.venue.address}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`chip ${status === "VALID" ? "chip-dark" : "chip-accent"}`}>
            {status === "VALID"
              ? "Valid"
              : status === "CHECKED_IN"
                ? "Checked in"
                : status === "VOID"
                  ? "Void"
                  : status === "EVENT_CANCELLED"
                    ? "Event cancelled"
                    : "Not active"}
          </span>
          {status === "VALID" ? <PrintButton /> : null}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_390px]">
        <section className="card-hard overflow-hidden ticket-print">
          <div className="border-b border-ink bg-paper-3 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="eyebrow">Gatefold / admit one</span>
              <span className="mono text-xs">{ticket.publicId}</span>
            </div>
          </div>
          <div className="grid gap-8 p-6 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <p className="eyebrow">Attendee</p>
              <p className="display-m mt-2">{ticket.attendeeName}</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="eyebrow">Ticket type</dt>
                  <dd className="mt-1">{ticket.reservationLine.ticketType.label}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Date and time</dt>
                  <dd className="mt-1">{formatDateTime(occurrence.startsAt, event.timezone)}</dd>
                  <dd className="text-xs faint">
                    {formatTimeRange(occurrence.startsAt, occurrence.endsAt, event.timezone)} / {event.timezone.replace("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Venue</dt>
                  <dd className="mt-1">{event.venue.name}</dd>
                  <dd className="text-xs faint">{event.venue.address}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Issued</dt>
                  <dd className="mt-1">{formatDateTime(ticket.issuedAt, event.timezone)}</dd>
                </div>
              </dl>
              <p className="mt-6 max-w-md border-l-2 border-line-strong pl-3 text-xs faint">
                This ticket is checked against the live reservation, event, and check-in record. A
                forwarded image can be refused if the ticket was already used, voided, or cancelled.
              </p>
            </div>
            <div className="flex flex-col items-center">
              {qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    width={260}
                    height={260}
                    alt={`Signed QR code for ticket ${ticket.publicId}`}
                    className="border border-ink bg-[#fbf7ee] p-2"
                  />
                  <p className="mt-3 max-w-[260px] text-center text-[0.7rem] faint">
                    Show this code at the door. The number below is the manual fallback.
                  </p>
                  <p className="mt-2 mono text-sm">{ticket.publicId}</p>
                </>
              ) : (
                <div className="flex h-[260px] w-[260px] flex-col items-center justify-center border border-line-strong bg-paper-3 p-6 text-center">
                  <p className="display-m">{status === "CHECKED_IN" ? "Used" : "No QR"}</p>
                  <p className="mt-2 text-xs muted">
                    {status === "CHECKED_IN"
                      ? "This ticket was already checked in."
                      : "This ticket cannot be used at the door."}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-3">
            <span className="mono text-xs faint">Demo ticket / no payment collected</span>
            <span className="mono text-xs faint">{formatMoney(ticket.reservationLine.unitPriceMinor, "USD")} demo value</span>
          </div>
        </section>

        <aside className="space-y-5 no-print">
          {checkedIn ? (
            <div className="card p-5">
              <p className="eyebrow">Check-in record</p>
              <p className="mt-2 text-lg">Checked in</p>
              <p className="mt-1 text-sm muted">{formatDateTime(checkedIn.scannedAt, event.timezone)}</p>
              {checkedIn.gateLabel ? <p className="mt-1 text-xs faint">Gate: {checkedIn.gateLabel}</p> : null}
            </div>
          ) : null}

          <div className="card p-5">
            <p className="eyebrow">Reservation</p>
            <p className="mt-2 text-sm">
              {ticket.reservationLine.reservation.buyerName}
              <br />
              <span className="faint">{ticket.reservationLine.reservation.buyerEmail}</span>
            </p>
            <p className="mt-3 chip chip-outline">{ticket.reservationLine.reservation.state}</p>
            <Link href={`/events/${event.slug}`} className="btn btn-sm mt-4 w-full">
              Event page
            </Link>
          </div>

          <div className="card p-5">
            <p className="eyebrow">Access</p>
            <p className="mt-2 text-sm muted">{event.venue.accessibility || "Contact the organizer for access questions."}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
