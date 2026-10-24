export interface AvailabilityRow {
  capacity: number;
  held: number;
  sold: number;
}

export function remaining(row: AvailabilityRow): number {
  return Math.max(0, row.capacity - row.held - row.sold);
}

export function availabilityLabel(row: AvailabilityRow): "SOLD_OUT" | "LOW" | "AVAILABLE" {
  const left = remaining(row);
  if (left === 0) return "SOLD_OUT";
  if (left <= 5) return "LOW";
  return "AVAILABLE";
}

export function invariantHolds(row: AvailabilityRow): boolean {
  return (
    row.capacity >= 0 &&
    row.held >= 0 &&
    row.sold >= 0 &&
    row.held + row.sold <= row.capacity
  );
}

export interface RequestedLine {
  inventoryId: string;
  quantity: number;
}

export function validateRequestedLines(lines: RequestedLine[]): void {
  if (lines.length === 0) throw new Error("At least one ticket type is required");
  const seen = new Set<string>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number");
    }
    if (line.quantity > 20) throw new Error("Quantity exceeds the per-order limit");
    if (seen.has(line.inventoryId)) throw new Error("Duplicate inventory line");
    seen.add(line.inventoryId);
  }
  if (lines.length > 8) throw new Error("Too many ticket types in one order");
}
