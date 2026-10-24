"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/dates";

export interface BookingTicket {
  id: string;
  label: string;
  description: string;
  priceMinor: number;
  currency: string;
  remaining: number;
  onSale: boolean;
  salesNote: string;
}

export interface BookingOccurrence {
  id: string;
  label: string;
  startDisplay: string;
  endDisplay: string;
  tickets: BookingTicket[];
}

export function BookingPanel({
  eventId,
  occurrences,
  soldOut,
}: {
  eventId: string;
  occurrences: BookingOccurrence[];
  soldOut: boolean;
}) {
  const router = useRouter();
  const [occurrenceId, setOccurrenceId] = useState(occurrences[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const keyRef = useRef<string>("");

  useEffect(() => {
    keyRef.current = crypto.randomUUID();
  }, [occurrenceId, quantities, buyer]);

  const occurrence = occurrences.find((item) => item.id === occurrenceId) ?? occurrences[0];
  const selectedTickets = occurrence?.tickets ?? [];
  const total = selectedTickets.reduce(
    (sum, ticket) => sum + ticket.priceMinor * (quantities[ticket.id] ?? 0),
    0
  );
  const count = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const currency = selectedTickets[0]?.currency ?? "USD";

  function setQuantity(ticket: BookingTicket, next: number) {
    const bounded = Math.max(0, Math.min(next, Math.min(20, ticket.remaining)));
    setQuantities((current) => ({ ...current, [ticket.id]: bounded }));
  }

  function changeOccurrence(id: string) {
    setOccurrenceId(id);
    setQuantities({});
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (count === 0) {
      setError("Choose at least one ticket.");
      return;
    }
    setSubmitting(true);
    try {
      const items = Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
      const response = await fetch(`/api/events/${eventId}/reservations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": keyRef.current,
        },
        body: JSON.stringify({
          eventId,
          occurrenceId,
          items,
          buyer,
        }),
      });
      const payload = (await response.json()) as
        | { ref: string }
        | { error: { message: string; code: string } };
      if (!response.ok || "error" in payload) {
        const message = "error" in payload ? payload.error.message : "The hold could not be created.";
        setError(message);
        if (response.status === 409 || response.status === 404) {
          router.refresh();
        }
        return;
      }
      router.push(`/checkout/${payload.ref}`);
    } catch {
      setError("The network dropped before the hold was created. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (occurrences.length === 0) {
    return (
      <div id="tickets" className="card-hard p-5">
        <p className="eyebrow">Tickets</p>
        <p className="mt-3 text-lg">No upcoming dates are on sale.</p>
        <p className="mt-2 text-sm muted">
          This event has no scheduled future occurrence. Check the programme for something else.
        </p>
      </div>
    );
  }

  return (
    <form id="tickets" onSubmit={submit} className="card-hard overflow-hidden">
      <div className="border-b border-ink bg-paper-3 px-5 py-3">
        <p className="eyebrow">Reserve tickets</p>
        <p className="mt-1 text-xs faint">
          A hold lasts 10 minutes. Inventory is rechecked on the server when you continue.
        </p>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <label className="label" htmlFor="occurrence">Date</label>
          <select
            id="occurrence"
            className="select"
            value={occurrenceId}
            onChange={(event) => changeOccurrence(event.target.value)}
          >
            {occurrences.map((item) => (
              <option key={item.id} value={item.id}>
                {item.startDisplay} {item.label ? `- ${item.label}` : ""}
              </option>
            ))}
          </select>
          <p className="hint">
            {occurrence.startDisplay} to {occurrence.endDisplay}
          </p>
        </div>

        <fieldset>
          <legend className="label">Ticket types</legend>
          <div className="space-y-3">
            {selectedTickets.map((ticket) => {
              const quantity = quantities[ticket.id] ?? 0;
              const unavailable = !ticket.onSale || ticket.remaining === 0;
              return (
                <div key={ticket.id} className={`border p-3 ${unavailable ? "border-line bg-paper-3 opacity-70" : "border-line-strong"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{ticket.label}</p>
                      <p className="mt-1 text-xs muted">{ticket.description}</p>
                      <p className="mt-1 mono text-xs faint">
                        {ticket.priceMinor === 0 ? "Free" : formatMoney(ticket.priceMinor, ticket.currency)}
                        {ticket.remaining > 0 && ticket.remaining <= 5 ? ` / ${ticket.remaining} left` : ""}
                      </p>
                      {unavailable ? (
                        <p className="mt-2 text-xs" style={{ color: "var(--accent-ink)" }}>
                          {ticket.remaining === 0 ? "Sold out for this date." : ticket.salesNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setQuantity(ticket, quantity - 1)}
                        disabled={unavailable || quantity === 0}
                        aria-label={`Remove one ${ticket.label}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={Math.min(20, ticket.remaining)}
                        value={quantity}
                        onChange={(event) => setQuantity(ticket, Number(event.target.value))}
                        className="input w-14 text-center"
                        aria-label={`Quantity for ${ticket.label}`}
                        disabled={unavailable}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setQuantity(ticket, quantity + 1)}
                        disabled={unavailable || quantity >= Math.min(20, ticket.remaining)}
                        aria-label={`Add one ${ticket.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="buyer-name">Buyer name</label>
            <input
              id="buyer-name"
              className="input"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={buyer.name}
              onChange={(event) => setBuyer({ ...buyer, name: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="buyer-email">Email</label>
            <input
              id="buyer-email"
              className="input"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              value={buyer.email}
              onChange={(event) => setBuyer({ ...buyer, email: event.target.value })}
            />
            <p className="hint">Used to retrieve the reservation and issue tickets.</p>
          </div>
          <div>
            <label className="label" htmlFor="buyer-phone">Phone (optional)</label>
            <input
              id="buyer-phone"
              className="input"
              autoComplete="tel"
              maxLength={40}
              value={buyer.phone}
              onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })}
            />
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="eyebrow">{count} ticket{count === 1 ? "" : "s"}</span>
          <span className="mono text-xl">{formatMoney(total, currency)}</span>
        </div>

        {error ? (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={submitting || soldOut}>
          {soldOut ? "Sold out" : submitting ? "Creating hold..." : "Hold these tickets"}
        </button>
        <p className="text-center text-xs faint">
          Demo checkout. No payment is collected at any step.
        </p>
      </div>
    </form>
  );
}
