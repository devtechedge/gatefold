"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/dates";

export interface CheckoutLine {
  id: string;
  label: string;
  quantity: number;
  unitPriceMinor: number;
}

export function CheckoutPanel({
  refId,
  eventSlug,
  holdExpiresAt,
  serverNow,
  lines,
  buyerName,
  buyerEmail,
  currency,
  totalMinor,
}: {
  refId: string;
  eventSlug: string;
  holdExpiresAt: string;
  serverNow: string;
  lines: CheckoutLine[];
  buyerName: string;
  buyerEmail: string;
  currency: string;
  totalMinor: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [names, setNames] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const line of lines) {
      initial[line.id] = Array.from({ length: line.quantity }, (_, index) =>
        index === 0 ? buyerName : ""
      );
    }
    return initial;
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = Math.max(0, new Date(holdExpiresAt).getTime() - now);
  const expired = remainingMs <= 0;
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const totalTickets = lines.reduce((sum, line) => sum + line.quantity, 0);

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (expired) {
      setError("This hold expired before checkout. Reserve the tickets again.");
      return;
    }
    setSubmitting(true);
    try {
      const attendees = lines.map((line) => ({
        lineId: line.id,
        names: (names[line.id] ?? []).map((name) => name.trim()).filter(Boolean),
      }));
      const response = await fetch(`/api/reservations/${refId}/demo-checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attendees }),
      });
      const payload = (await response.json()) as
        | { data: unknown }
        | { error: { message: string } };
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Checkout could not be completed.");
        router.refresh();
        return;
      }
      router.push(`/reservation/${refId}`);
      router.refresh();
    } catch {
      setError("The network dropped before confirmation. Your hold is still open until the timer ends.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    setError(null);
    setCancelling(true);
    try {
      const response = await fetch(`/api/reservations/${refId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled at checkout" }),
      });
      const payload = (await response.json()) as
        | { data: unknown }
        | { error: { message: string } };
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "The hold could not be cancelled.");
        return;
      }
      router.push(`/reservation/${refId}`);
      router.refresh();
    } catch {
      setError("The network dropped before the hold was cancelled.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={confirm} className="min-w-0 space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Demo checkout</p>
              <h2 className="display-m mt-2">Confirm the reservation</h2>
            </div>
            <div
              role="timer"
              aria-live="off"
              className={`chip ${expired ? "chip-accent" : "chip-dark"}`}
              aria-label={`Hold expires in ${minutes} minutes ${seconds} seconds`}
            >
              {expired ? "Hold expired" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} left`}
            </div>
          </div>
          <p className="mt-3 text-sm muted">
            This is a simulated confirmation. No card details are requested, no payment provider is
            called, and no money is collected. Confirming issues real tickets against this hold.
          </p>
          {expired ? (
            <div className="notice notice-error mt-4">
              <p>The hold has expired and its inventory has been released.</p>
              <Link href={`/events/${eventSlug}`} className="link mt-2 inline-block">
                Return to the event and reserve again
              </Link>
            </div>
          ) : null}
        </div>

        <div className="card p-5">
          <p className="eyebrow">Attendee names</p>
          <p className="mt-2 text-sm muted">
            One name per issued ticket. Leave a field blank to use &quot;{buyerName} guest&quot;.
          </p>
          <div className="mt-4 space-y-5">
            {lines.map((line) => (
              <fieldset key={line.id}>
                <legend className="label">
                  {line.label} / {line.quantity} ticket{line.quantity === 1 ? "" : "s"}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: line.quantity }).map((_, index) => (
                    <input
                      key={index}
                      className="input"
                      maxLength={120}
                      value={names[line.id]?.[index] ?? ""}
                      placeholder={index === 0 ? buyerName : `Guest ${index + 1}`}
                      aria-label={`${line.label} attendee ${index + 1}`}
                      onChange={(event) => {
                        const next = [...(names[line.id] ?? [])];
                        next[index] = event.target.value;
                        setNames({ ...names, [line.id]: next });
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        {error ? <p role="alert" className="notice notice-error">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={submitting || expired}>
            {submitting ? "Confirming..." : "Complete demo checkout"}
          </button>
          {confirmCancel ? (
            <span className="flex items-center gap-2">
              <button type="button" className="btn btn-danger btn-sm" onClick={cancel} disabled={cancelling}>
                {cancelling ? "Cancelling..." : "Yes, release the hold"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(true)}>
              Cancel hold
            </button>
          )}
        </div>
      </form>

      <aside className="min-w-0">
        <div className="card-hard overflow-hidden lg:sticky lg:top-24">
          <div className="border-b border-ink bg-paper-3 px-5 py-3">
            <p className="eyebrow">Reservation summary</p>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="eyebrow">Buyer</p>
              <p className="mt-1 text-sm">{buyerName}</p>
              <p className="text-xs faint">{buyerEmail}</p>
            </div>
            <div className="border-t border-line pt-4">
              <p className="eyebrow">Tickets</p>
              <ul className="mt-2 space-y-2">
                {lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3 text-sm">
                    <span>
                      {line.label} <span className="faint">x{line.quantity}</span>
                    </span>
                    <span className="mono">{formatMoney(line.unitPriceMinor * line.quantity, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink pt-4">
              <span className="eyebrow">{totalTickets} ticket{totalTickets === 1 ? "" : "s"}</span>
              <span className="mono text-2xl">{formatMoney(totalMinor, currency)}</span>
            </div>
            <p className="text-xs faint">
              Demo total. Nothing will be charged and no refund policy applies to a simulated payment.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
