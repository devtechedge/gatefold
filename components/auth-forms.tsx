"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, registerAction } from "@/app/auth-actions";
import type { AuthState } from "@/lib/auth/state";

const initialState: AuthState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {state.error ? <p role="alert" className="notice notice-error">{state.error}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-center text-sm muted">
        New to Gatefold?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="link">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, initialState);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="register-name">Your name</label>
        <input
          id="register-name"
          name="displayName"
          className="input"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="register-email">Email</label>
        <input
          id="register-email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="register-password">Password</label>
        <input
          id="register-password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="hint">At least 10 characters. Stored as a scrypt hash, never plain text.</p>
      </div>
      {state.error ? <p role="alert" className="notice notice-error">{state.error}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm muted">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="link">Sign in</Link>
      </p>
    </form>
  );
}
