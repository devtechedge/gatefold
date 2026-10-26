"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { loginSchema, registerSchema } from "@/validation/schemas";
import { loginUser, registerUser } from "@/services/auth";
import { sha256 } from "@/lib/ids";
import { HttpError } from "@/lib/errors";
import type { AuthState } from "@/lib/auth/state";

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/organizer";
  return next;
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the email and password." };
  }
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const ipLimit = await rateLimit(`login:ip:${ip}`, 40, 900);
  const emailLimit = await rateLimit(`login:email:${sha256(parsed.data.email).slice(0, 32)}`, 10, 900);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }
  try {
    await loginUser(parsed.data);
  } catch (error) {
    if (error instanceof HttpError) return { error: error.message };
    throw error;
  }
  redirect(safeNext(formData.get("next")));
}

export async function registerAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const limit = await rateLimit(`register:ip:${ip}`, 10, 3600);
  if (!limit.allowed) {
    return { error: "Too many new accounts from this connection. Try again later." };
  }
  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (error instanceof HttpError) return { error: error.message };
    throw error;
  }
  redirect(safeNext(formData.get("next")));
}
