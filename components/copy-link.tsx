"use client";

import { useState } from "react";

export function CopyLink({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-sm" onClick={copy}>
        {copied ? "Copied" : label}
      </button>
      {error ? <span className="text-xs" style={{ color: "var(--accent-ink)" }}>Copy failed. Select the link manually.</span> : null}
    </span>
  );
}
