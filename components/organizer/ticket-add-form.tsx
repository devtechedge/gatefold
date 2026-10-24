"use client";

import { useActionState, useState } from "react";
import { addTicketTypeAction } from "@/app/organizer/actions";

export function TicketAddForm({ eventId, occurrenceCount }: { eventId: string; occurrenceCount: number }) {
  const [state, action, pending] = useActionState(addTicketTypeAction, {});
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [salesStart, setSalesStart] = useState("");
  const [salesEnd, setSalesEnd] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ticket-label">Ticket name</label>
          <input
            id="ticket-label"
            name="label"
            className="input"
            required
            maxLength={80}
            placeholder="General admission"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ticket-price">Price in USD</label>
          <input
            id="ticket-price"
            name="price"
            className="input"
            required
            inputMode="decimal"
            placeholder="24.00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ticket-capacity">Capacity per occurrence</label>
          <input
            id="ticket-capacity"
            name="capacity"
            className="input"
            required
            type="number"
            min={1}
            max={10000}
            placeholder="40"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
          <p className="hint">
            Applied to each of the {occurrenceCount} occurrence{occurrenceCount === 1 ? "" : "s"}.
            Capacity is scoped to the date and ticket type.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="ticket-description">Short description</label>
          <input
            id="ticket-description"
            name="description"
            className="input"
            maxLength={400}
            placeholder="Standing and bench seating."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ticket-sales-start">Sales open (optional)</label>
          <input
            id="ticket-sales-start"
            name="salesStartLocal"
            type="datetime-local"
            className="input"
            value={salesStart}
            onChange={(event) => setSalesStart(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ticket-sales-end">Sales close (optional)</label>
          <input
            id="ticket-sales-end"
            name="salesEndLocal"
            type="datetime-local"
            className="input"
            value={salesEnd}
            onChange={(event) => setSalesEnd(event.target.value)}
          />
          <p className="hint">Sales always close when the occurrence starts.</p>
        </div>
      </div>
      {state.error ? <p role="alert" className="notice notice-error">{state.error}</p> : null}
      {state.message ? <p role="status" className="notice notice-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Adding..." : "Add ticket type"}
      </button>
    </form>
  );
}
