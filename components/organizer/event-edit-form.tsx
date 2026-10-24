"use client";

import { useActionState, useState } from "react";
import { updateEventAction } from "@/app/organizer/actions";
import { ARTWORKS, CATEGORIES } from "@/domain/types";

export function EventEditForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: {
    title: string;
    description: string;
    category: string;
    artwork: string;
    accessibility: string;
  };
}) {
  const [state, action, pending] = useActionState(updateEventAction, {});
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [artwork, setArtwork] = useState(initial.artwork);
  const [accessibility, setAccessibility] = useState(initial.accessibility);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div>
        <label className="label" htmlFor="edit-title">Title</label>
        <input
          id="edit-title"
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
        <label className="label" htmlFor="edit-description">Description</label>
        <textarea
          id="edit-description"
          name="description"
          className="textarea"
          required
          minLength={20}
          maxLength={6000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="edit-category">Category</label>
          <select
            id="edit-category"
            name="category"
            className="select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="edit-artwork">Poster tone</label>
          <select
            id="edit-artwork"
            name="artwork"
            className="select"
            value={artwork}
            onChange={(event) => setArtwork(event.target.value)}
          >
            {ARTWORKS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="edit-accessibility">Venue accessibility notes</label>
        <textarea
          id="edit-accessibility"
          name="accessibility"
          className="textarea"
          maxLength={1000}
          value={accessibility}
          onChange={(event) => setAccessibility(event.target.value)}
        />
      </div>
      {state.error ? <p role="alert" className="notice notice-error">{state.error}</p> : null}
      {state.message ? <p role="status" className="notice notice-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving..." : "Save event details"}
      </button>
    </form>
  );
}
