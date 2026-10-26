"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4efe4", color: "#17141c", fontFamily: "Georgia, serif" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px" }}>
          <p style={{ fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 }}>
            Gatefold / request {error.digest ?? "unknown"}
          </p>
          <h1 style={{ fontSize: 44, lineHeight: 1, margin: "18px 0" }}>The application stopped.</h1>
          <p style={{ lineHeight: 1.6 }}>
            The root layout could not render. No inventory or ticket state was changed by this screen.
            Reload the page or return to the programme.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "12px 18px",
                background: "#17141c",
                color: "#f4efe4",
                border: "1px solid #17141c",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                padding: "12px 18px",
                border: "1px solid #17141c",
                color: "#17141c",
                textDecoration: "none",
              }}
            >
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
