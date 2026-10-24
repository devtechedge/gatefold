"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state";

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Working...",
  variant = "primary",
  className = "",
  buttonClassName = "",
  buttonFull = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "accent" | "outline" | "danger" | "ghost";
  className?: string;
  buttonClassName?: string;
  buttonFull?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "accent"
        ? "btn-accent"
        : variant === "danger"
          ? "btn-danger"
          : variant === "ghost"
            ? "btn-ghost"
            : "";
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? <p role="alert" className="notice notice-error mt-3">{state.error}</p> : null}
      {state.message ? <p role="status" className="notice notice-success mt-3">{state.message}</p> : null}
      {state.link ? (
        <p className="mt-3 break-all border border-line bg-paper p-3 mono text-xs">
          <a className="link" href={state.link}>{state.link}</a>
        </p>
      ) : null}
      <button
        type="submit"
        className={`btn ${variantClass} ${buttonFull ? "w-full" : ""} ${buttonClassName} ${children ? "mt-4" : ""}`}
        disabled={pending}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
