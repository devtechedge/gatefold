import { withApi, jsonOk, readJson, parseValidation, assertSameOrigin } from "@/lib/http";
import { requireApiUser, organizerContext } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { inviteMember, listTeam } from "@/services/auth";
import { inviteSchema } from "@/validation/schemas";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const user = await requireApiUser();
  const organizerId = new URL(request.url).searchParams.get("organizerId") ?? "";
  if (!organizerId) throw new HttpError("VALIDATION_ERROR", "organizerId is required.", 400);
  await organizerContext(user.id, organizerId, "team:manage");
  const team = await listTeam(organizerId);
  return jsonOk({
    data: {
      members: team.members.map((member) => ({
        id: member.id,
        role: member.role,
        status: member.status,
        user: member.user,
        createdAt: member.createdAt.toISOString(),
      })),
      invitations: team.invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      })),
    },
  });
});

export const POST = withApi(async (request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const body = await readJson<Record<string, unknown>>(request);
  const organizerId = typeof body.organizerId === "string" ? body.organizerId : "";
  if (!organizerId) throw new HttpError("VALIDATION_ERROR", "organizerId is required.", 400);
  await organizerContext(user.id, organizerId, "team:manage");
  const input = parseValidation(
    inviteSchema.safeParse({ email: body.email, role: body.role })
  );
  const invitation = await inviteMember({
    organizerId,
    actorUserId: user.id,
    email: input.email,
    role: input.role,
  });
  return jsonOk(
    {
      data: {
        link: `/invite/${invitation.token}`,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    },
    201
  );
});
