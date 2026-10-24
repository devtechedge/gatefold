"use client";

import { useActionState, useState } from "react";
import { updateOrganizerSettingsAction } from "@/app/organizer/actions";

export function OrganizerSettingsForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateOrganizerSettingsAction, {});
  const [name, setName] = useState(initialName);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="organizer-name">Organizer name</label>
        <input
          id="organizer-name"
          name="name"
          className="input"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <p className="hint">This appears on every public event page and in audit records.</p>
      </div>
      {state.error ? <p role="alert" className="notice notice-error">{state.error}</p> : null}
      {state.message ? <p role="status" className="notice notice-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
