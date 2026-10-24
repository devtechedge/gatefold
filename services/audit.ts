import type { TransactionClient } from "@/lib/db";

export async function recordAudit(
  tx: TransactionClient,
  input: {
    organizerId: string;
    actorUserId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      organizerId: input.organizerId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? "",
      targetId: input.targetId ?? "",
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
}
