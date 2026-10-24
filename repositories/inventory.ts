import type { TransactionClient } from "@/lib/db";

export interface InventoryRow {
  id: string;
  capacity: number;
  held: number;
  sold: number;
}

/**
 * Atomic conditional hold. Zero affected rows means the requested quantity is
 * no longer available, regardless of what the client last rendered.
 */
export async function holdInventory(
  tx: TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<InventoryRow | null> {
  const rows = await tx.$queryRaw<InventoryRow[]>`
    UPDATE ticket_inventory
    SET held = held + ${quantity}, version = version + 1, "updatedAt" = now()
    WHERE id = ${inventoryId}
      AND capacity - sold - held >= ${quantity}
    RETURNING id, capacity, held, sold
  `;
  return rows[0] ?? null;
}

export async function commitInventory(
  tx: TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE ticket_inventory
    SET held = held - ${quantity}, sold = sold + ${quantity},
        version = version + 1, "updatedAt" = now()
    WHERE id = ${inventoryId} AND held >= ${quantity}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function releaseHeld(
  tx: TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE ticket_inventory
    SET held = held - ${quantity}, version = version + 1, "updatedAt" = now()
    WHERE id = ${inventoryId} AND held >= ${quantity}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function releaseSold(
  tx: TransactionClient,
  inventoryId: string,
  quantity: number
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE ticket_inventory
    SET sold = sold - ${quantity}, version = version + 1, "updatedAt" = now()
    WHERE id = ${inventoryId} AND sold >= ${quantity}
    RETURNING id
  `;
  return rows.length > 0;
}
