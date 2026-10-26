"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-sm no-print" onClick={() => window.print()}>
      Print ticket
    </button>
  );
}
