"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createEventAction } from "@/app/organizer/actions";
import { EventArtwork } from "@/components/event-artwork";
import { ARTWORKS, CATEGORIES } from "@/domain/types";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

interface OccurrenceRow {
  start: string;
  end: string;
  label: string;
}

export function EventCreateForm({
  defaultOccurrence,
}: {
  defaultOccurrence: { start: string; end: string };
}) {
  const [state, action, pending] = useActionState(createEventAction, {});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [artwork, setArtwork] = useState<string>(ARTWORKS[0]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([
    { start: defaultOccurrence.start, end: defaultOccurrence.end, label: "" },
  ]);

  function updateRow(index: number, patch: Partial<OccurrenceRow>) {
    setOccurrences((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function useMyTimezone() {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Keep the current value.
    }
  }

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <div className="card p-5">
          <p className="eyebrow">01 / The event</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input
                id="title"
                name="title"
                className="input"
                required
                minLength={3}
                maxLength={140}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                className="textarea"
                required
                minLength={20}
                maxLength={6000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="hint">At least 20 characters. This appears on the public event page.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  className="select"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {CATEGORIES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="artwork">Poster tone</label>
                <select
                  id="artwork"
                  name="artwork"
                  className="select"
                  value={artwork}
                  onChange={(event) => setArtwork(event.target.value)}
                >
                  {ARTWORKS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <p className="eyebrow">02 / The room</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="venueName">Venue name</label>
              <input
                id="venueName"
                name="venueName"
                className="input"
                required
                maxLength={120}
                value={venueName}
                onChange={(event) => setVenueName(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="timezone">Timezone</label>
              <div className="flex gap-2">
                <input
                  id="timezone"
                  name="timezone"
                  className="input"
                  list="timezones"
                  required
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                />
                <datalist id="timezones">
                  {TIMEZONES.map((zone) => <option key={zone} value={zone} />)}
                </datalist>
                <button type="button" className="btn btn-sm shrink-0" onClick={useMyTimezone}>
                  Mine
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="venueAddress">Address</label>
              <input
                id="venueAddress"
                name="venueAddress"
                className="input"
                required
                maxLength={300}
                value={venueAddress}
                onChange={(event) => setVenueAddress(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="accessibility">Accessibility notes</label>
              <textarea
                id="accessibility"
                name="accessibility"
                className="textarea"
                maxLength={1000}
                value={accessibility}
                onChange={(event) => setAccessibility(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">03 / Dates</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setOccurrences((current) => [...current, { start: "", end: "", label: "" }])}
            >
              Add date
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {occurrences.map((row, index) => (
              <fieldset key={index} className="border border-line p-3">
                <legend className="label px-1">Date {index + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`start-${index}`}>Starts</label>
                    <input
                      id={`start-${index}`}
                      name="occurrenceStart"
                      type="datetime-local"
                      className="input"
                      required
                      value={row.start}
                      onChange={(event) => updateRow(index, { start: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`end-${index}`}>Ends</label>
                    <input
                      id={`end-${index}`}
                      name="occurrenceEnd"
                      type="datetime-local"
                      className="input"
                      required
                      value={row.end}
                      onChange={(event) => updateRow(index, { end: event.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor={`label-${index}`}>Label (optional)</label>
                    <input
                      id={`label-${index}`}
                      name="occurrenceLabel"
                      className="input"
                      maxLength={80}
                      placeholder="Friday session"
                      value={row.label}
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                    />
                  </div>
                </div>
                {occurrences.length > 1 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-3"
                    onClick={() => setOccurrences((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    Remove this date
                  </button>
                ) : null}
              </fieldset>
            ))}
          </div>
        </div>

        {state.error ? <p role="alert" className="notice notice-error">{state.error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Creating..." : "Create draft event"}
          </button>
          <p className="text-sm faint">The event stays a draft until you add tickets and publish it.</p>
        </div>
      </div>

      <aside>
        <div className="card-hard overflow-hidden lg:sticky lg:top-6">
          <EventArtwork artwork={artwork} title={title || "Untitled event"} className="aspect-[4/3] w-full" />
          <div className="p-5">
            <p className="eyebrow">Preview</p>
            <h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--type-display)" }}>
              {title || "Untitled event"}
            </h2>
            <p className="mt-2 text-sm faint">{category} / {venueName || "Venue to be named"}</p>
            <p className="mt-3 text-xs muted">{timezone}</p>
            <p className="mt-4 line-clamp-4 text-sm muted">
              {description || "The event description will appear here."}
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
