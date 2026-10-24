import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { randomToken, sha256 } from "@/lib/ids";
import { createSession } from "@/lib/auth/session";
import { can, type Capability, type Role } from "@/domain/permissions";
import { uniqueOrganizerSlug } from "./events";
import { recordAudit } from "./audit";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ id: string }> {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new HttpError("CONFLICT", "An account with that email already exists. Sign in instead.", 409);
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: { email, displayName: input.displayName.trim(), passwordHash },
    });
    await createSession(user.id);
    return { id: user.id };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new HttpError("CONFLICT", "An account with that email already exists. Sign in instead.", 409);
    }
    throw error;
  }
}

export async function loginUser(input: { email: string; password: string }): Promise<{ id: string }> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !valid) {
    throw new HttpError("UNAUTHORIZED", "Email or password is incorrect.", 401);
  }
  if (user.disabled) {
    throw new HttpError("FORBIDDEN", "This account is disabled.", 403);
  }
  await createSession(user.id);
  return { id: user.id };
}

export async function createOrganizerForUser(userId: string, name: string) {
  const slug = await uniqueOrganizerSlug(name);
  return prisma.$transaction(async (tx) => {
    const organizer = await tx.organizer.create({
      data: { name: name.trim(), slug, ownerId: userId },
    });
    await tx.organizerMembership.create({
      data: {
        organizerId: organizer.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      organizerId: organizer.id,
      actorUserId: userId,
      action: "organizer.created",
      targetType: "organizer",
      targetId: organizer.id,
      metadata: { name: organizer.name },
    });
    return { id: organizer.id, slug: organizer.slug };
  });
}

export async function updateOrganizerSettings(input: {
  organizerId: string;
  actorUserId: string;
  name: string;
  venueName?: string;
  venueAddress?: string;
  venueTimezone?: string;
  accessibility?: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.organizer.update({ where: { id: input.organizerId }, data: { name: input.name } });
    if (input.venueName && input.venueAddress && input.venueTimezone) {
      const venue = await tx.venue.findFirst({
        where: { organizerId: input.organizerId },
        orderBy: { createdAt: "asc" },
      });
      if (venue) {
        await tx.venue.update({
          where: { id: venue.id },
          data: {
            name: input.venueName,
            address: input.venueAddress,
            timezone: input.venueTimezone,
            accessibility: input.accessibility ?? "",
          },
        });
      } else {
        await tx.venue.create({
          data: {
            organizerId: input.organizerId,
            name: input.venueName,
            address: input.venueAddress,
            timezone: input.venueTimezone,
            accessibility: input.accessibility ?? "",
          },
        });
      }
    }
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "organizer.settings_updated",
      targetType: "organizer",
      targetId: input.organizerId,
    });
  });
}

export async function requireCapability(
  userId: string,
  organizerId: string,
  capability: Capability
): Promise<Role> {
  const membership = await prisma.organizerMembership.findUnique({
    where: { organizerId_userId: { organizerId, userId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new HttpError("FORBIDDEN", "You do not have access to this organizer.", 403);
  }
  const role = membership.role as Role;
  if (!can(role, capability)) {
    throw new HttpError("FORBIDDEN", "Your role does not allow that action.", 403);
  }
  return role;
}

export async function inviteMember(input: {
  organizerId: string;
  actorUserId: string;
  email: string;
  role: "MANAGER" | "CHECKIN";
}): Promise<{ token: string; expiresAt: Date }> {
  await requireCapability(input.actorUserId, input.organizerId, "team:manage");
  const email = normalizeEmail(input.email);
  const existingMember = await prisma.organizerMembership.findFirst({
    where: { organizerId: input.organizerId, user: { email } },
  });
  if (existingMember) {
    throw new HttpError("CONFLICT", "That person is already on the team.", 409);
  }
  await prisma.organizerInvitation.updateMany({
    where: { organizerId: input.organizerId, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await prisma.organizerInvitation.create({
    data: {
      organizerId: input.organizerId,
      email,
      role: input.role,
      tokenHash: sha256(token),
      invitedById: input.actorUserId,
      expiresAt,
    },
  });
  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "team.invited",
      targetType: "organizer_invitation",
      targetId: invitation.id,
      metadata: { role: input.role },
    });
  });
  return { token, expiresAt };
}

export async function invitationByToken(token: string) {
  return prisma.organizerInvitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { organizer: { select: { name: true, slug: true } } },
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await invitationByToken(token);
  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.acceptedAt ||
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    throw new HttpError("INVALID_STATE", "This invitation is no longer valid.", 409);
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || user.email !== invitation.email) {
    throw new HttpError(
      "FORBIDDEN",
      "Sign in with the email address this invitation was sent to.",
      403
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.organizerMembership.upsert({
      where: {
        organizerId_userId: { organizerId: invitation.organizerId, userId },
      },
      update: {
        role: invitation.role,
        status: "ACTIVE",
        invitedAt: invitation.createdAt,
        invitedById: invitation.invitedById,
        acceptedAt: new Date(),
      },
      create: {
        organizerId: invitation.organizerId,
        userId,
        role: invitation.role,
        status: "ACTIVE",
        invitedAt: invitation.createdAt,
        invitedById: invitation.invitedById,
        acceptedAt: new Date(),
      },
    });
    await tx.organizerInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    await recordAudit(tx, {
      organizerId: invitation.organizerId,
      actorUserId: userId,
      action: "team.invitation_accepted",
      targetType: "organizer_membership",
      targetId: userId,
      metadata: { role: invitation.role },
    });
  });
  return invitation.organizer;
}

export async function listTeam(organizerId: string) {
  const [members, invitations] = await Promise.all([
    prisma.organizerMembership.findMany({
      where: { organizerId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organizerInvitation.findMany({
      where: { organizerId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { members, invitations };
}

export async function updateMemberRole(input: {
  organizerId: string;
  actorUserId: string;
  membershipId: string;
  role: "MANAGER" | "CHECKIN";
}) {
  await requireCapability(input.actorUserId, input.organizerId, "team:manage");
  const membership = await prisma.organizerMembership.findUnique({
    where: { id: input.membershipId },
  });
  if (!membership || membership.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Team member not found.", 404);
  }
  if (membership.role === "OWNER") {
    throw new HttpError("FORBIDDEN", "The owner role cannot be reassigned here.", 403);
  }
  await prisma.$transaction(async (tx) => {
    await tx.organizerMembership.update({
      where: { id: membership.id },
      data: { role: input.role },
    });
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "team.role_updated",
      targetType: "organizer_membership",
      targetId: membership.id,
      metadata: { role: input.role },
    });
  });
}

export async function removeMember(input: {
  organizerId: string;
  actorUserId: string;
  membershipId: string;
}) {
  await requireCapability(input.actorUserId, input.organizerId, "team:manage");
  const membership = await prisma.organizerMembership.findUnique({
    where: { id: input.membershipId },
  });
  if (!membership || membership.organizerId !== input.organizerId) {
    throw new HttpError("NOT_FOUND", "Team member not found.", 404);
  }
  if (membership.role === "OWNER") {
    throw new HttpError("FORBIDDEN", "The organizer owner cannot be removed.", 403);
  }
  await prisma.$transaction(async (tx) => {
    await tx.organizerMembership.delete({ where: { id: membership.id } });
    await recordAudit(tx, {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId,
      action: "team.member_removed",
      targetType: "organizer_membership",
      targetId: membership.id,
    });
  });
}
