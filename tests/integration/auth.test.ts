import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/ids";
import { acceptInvitation, changePassword, deleteOwnAccount, inviteMember } from "@/services/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createFixture, cleanupFixture, type Fixture } from "../helpers/fixtures";

const fixtures: Fixture[] = [];
const extraUsers: string[] = [];

async function make() {
  const fixture = await createFixture({ capacity: 2 });
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const id of extraUsers.splice(0)) {
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  for (const fixture of fixtures.splice(0)) {
    await cleanupFixture(fixture);
  }
});

describe("account deletion", () => {
  it("revokes sessions, removes memberships and anonymizes a non-owner", async () => {
    const fixture = await make();
    const token = randomToken(32);
    const sessionId = sha256(`${env.sessionPepper}:${token}`);
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: fixture.staffId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await deleteOwnAccount(fixture.staffId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.staffId } });
    expect(user.disabled).toBe(true);
    expect(user.displayName).toBe("Deleted account");
    expect(user.email).toMatch(/^deleted-.*@invalid\.local$/);
    expect(await prisma.session.count({ where: { userId: fixture.staffId } })).toBe(0);
    expect(await prisma.organizerMembership.count({ where: { userId: fixture.staffId } })).toBe(0);
  });

  it("refuses to delete an organizer owner", async () => {
    const fixture = await make();
    await expect(deleteOwnAccount(fixture.ownerId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: fixture.ownerId } });
    expect(user.disabled).toBe(false);
  });
});

describe("invitation acceptance", () => {
  it("adds the invited role once and rejects token reuse", async () => {
    const fixture = await make();
    const email = `invitee-${randomUUID().slice(0, 8)}@example.test`;
    const invitation = await inviteMember({
      organizerId: fixture.organizerId,
      actorUserId: fixture.ownerId,
      email,
      role: "CHECKIN",
    });
    const invitee = await prisma.user.create({
      data: { email, displayName: "Invitee", passwordHash: "not-used" },
    });
    extraUsers.push(invitee.id);

    const organizer = await acceptInvitation(invitation.token, invitee.id);
    expect(organizer.slug).toContain("test-organizer");
    const membership = await prisma.organizerMembership.findUniqueOrThrow({
      where: { organizerId_userId: { organizerId: fixture.organizerId, userId: invitee.id } },
    });
    expect(membership.role).toBe("CHECKIN");
    expect(membership.status).toBe("ACTIVE");
    expect(membership.acceptedAt).not.toBeNull();
    await expect(acceptInvitation(invitation.token, invitee.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("refuses an invitation accepted by a different email", async () => {
    const fixture = await make();
    const invitation = await inviteMember({
      organizerId: fixture.organizerId,
      actorUserId: fixture.ownerId,
      email: `invited-${randomUUID().slice(0, 8)}@example.test`,
      role: "MANAGER",
    });
    const wrongUser = await prisma.user.create({
      data: {
        email: `wrong-${randomUUID().slice(0, 8)}@example.test`,
        displayName: "Wrong user",
        passwordHash: "not-used",
      },
    });
    extraUsers.push(wrongUser.id);
    await expect(acceptInvitation(invitation.token, wrongUser.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("password change", () => {
  it("changes the hash only with the current password", async () => {
    const fixture = await make();
    const oldHash = await hashPassword("old-password-1");
    await prisma.user.update({ where: { id: fixture.ownerId }, data: { passwordHash: oldHash } });
    await expect(
      changePassword({ userId: fixture.ownerId, currentPassword: "wrong-password", newPassword: "new-password-1" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await changePassword({
      userId: fixture.ownerId,
      currentPassword: "old-password-1",
      newPassword: "new-password-1",
    });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: fixture.ownerId } });
    expect(await verifyPassword("new-password-1", updated.passwordHash)).toBe(true);
    expect(await verifyPassword("old-password-1", updated.passwordHash)).toBe(false);
  });
});
