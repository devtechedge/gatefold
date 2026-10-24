"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelReservation({ refId }: { refId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reservations/${refId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled from the reservation page" }),
      });
      const payload = (await response.json()) as
        | { data: unknown }
        | { error: { message: string } };
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "The reservation could not be cancelled.");
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("The network dropped before the cancellation completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-danger btn-sm" onClick={cancel} disabled={pending}>
            {pending ? "Cancelling..." : "Confirm cancellation"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
            Keep reservation
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>
          Cancel reservation
        </button>
      )}
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      <p className="mt-2 text-xs faint">
        Confirmed tickets can be cancelled by the buyer until 24 hours before the first occurrence.
        Organizers can cancel separately.
      </p>
    </div>
  );
}
