import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-baseline gap-2" aria-label="Gatefold home">
      <span
        style={{
          fontFamily: "var(--type-display)",
          fontSize: compact ? "1.35rem" : "1.55rem",
          fontWeight: 640,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        Gatefold
      </span>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "0.72rem",
          height: "0.72rem",
          border: "1.5px solid currentColor",
          borderLeftColor: "transparent",
          borderRadius: "50%",
        }}
      />
    </Link>
  );
}
