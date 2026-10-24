"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReservationFinder() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Paste the reservation link you saved.");
      return;
    }
    let reference = trimmed;
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const index = parts.findIndex((part) => part === "reservation" || part === "checkout");
      reference = index >= 0 ? parts[index + 1] ?? "" : "";
    } catch {
      // A bare reference is accepted.
    }
    reference = decodeURIComponent(reference).replace(/\/$/, "");
    if (!reference || !reference.includes(".")) {
      setError("That does not look like a reservation link. It should contain a long reference with a dot.");
      return;
    }
    router.push(`/reservation/${encodeURIComponent(reference)}`);
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <label className="label" htmlFor="reservation-link">Reservation link or reference</label>
      <input
        id="reservation-link"
        className="input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://.../reservation/abc123.signature"
        autoComplete="off"
        spellCheck={false}
      />
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      <button type="submit" className="btn btn-primary mt-4">Open reservation</button>
    </form>
  );
}
