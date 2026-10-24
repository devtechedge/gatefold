import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/ids";

const SESSION_COOKIE = "gf_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function tokenId(token: string): string {
  return sha256(`${env.sessionPepper}:${token}`);
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  sessionId: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  await prisma.session.create({
    data: {
      id: tokenId(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: tokenId(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sessionId = tokenId(token);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.disabled) {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    sessionId,
  };
}

export async function requirePageUser(returnTo = "/organizer"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function destroyOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, id: { not: keepSessionId } },
  });
}
