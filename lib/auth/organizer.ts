import { prisma } from "@/lib/db";
import { currentUser, type SessionUser } from "@/lib/auth/session";
import { can, type Capability, type Role } from "@/domain/permissions";
import { HttpError, forbidden, notFound, unauthorized } from "@/lib/errors";

export { HttpError, unauthorized, forbidden, notFound };

export interface OrganizerContext {
  user: SessionUser;
  organizerId: string;
  organizerName: string;
  organizerSlug: string;
  role: Role;
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function organizerContext(
  userId: string,
  organizerId: string,
  capability: Capability
): Promise<OrganizerContext> {
  const membership = await prisma.organizerMembership.findUnique({
    where: { organizerId_userId: { organizerId, userId } },
    include: { organizer: true },
  });
  if (!membership || membership.status !== "ACTIVE") throw forbidden();
  const role = membership.role as Role;
  if (!can(role, capability)) throw forbidden();
  return {
    user: { id: userId, email: "", displayName: "", sessionId: "" },
    organizerId,
    organizerName: membership.organizer.name,
    organizerSlug: membership.organizer.slug,
    role,
  };
}

export async function eventAccess(
  userId: string,
  eventId: string,
  capability: Capability
): Promise<{ event: { id: string; organizerId: string; slug: string; title: string }; role: Role }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true, slug: true, title: true },
  });
  if (!event) throw notFound("Event not found.");
  const membership = await prisma.organizerMembership.findUnique({
    where: { organizerId_userId: { organizerId: event.organizerId, userId } },
  });
  if (!membership || membership.status !== "ACTIVE") throw forbidden();
  const role = membership.role as Role;
  if (!can(role, capability)) throw forbidden();
  return { event, role };
}

export async function requireMembershipForPage(userId: string) {
  return prisma.organizerMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { organizer: true },
    orderBy: { createdAt: "asc" },
  });
}
