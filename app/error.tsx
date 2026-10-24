"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error.message);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="eyebrow">Error / Request {error.digest ?? "unknown"}</p>
        <h1 className="display-l mt-3">The request stopped.</h1>
        <p className="mt-4 text-sm muted">
          Something failed while rendering this page. No inventory or ticket state was changed by
          this screen. Try the request again.
        </p>
        <button type="button" className="btn btn-primary mt-8" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
