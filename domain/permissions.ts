export type Role = "OWNER" | "MANAGER" | "CHECKIN";

export type Capability =
  | "organizer:manage"
  | "event:manage"
  | "event:publish"
  | "event:cancel"
  | "ticket:manage"
  | "attendee:read"
  | "attendee:lookup"
  | "checkin:perform"
  | "team:manage"
  | "audit:read";

const CAPABILITIES: Record<Role, Capability[]> = {
  OWNER: [
    "organizer:manage",
    "event:manage",
    "event:publish",
    "event:cancel",
    "ticket:manage",
    "attendee:read",
    "attendee:lookup",
    "checkin:perform",
    "team:manage",
    "audit:read",
  ],
  MANAGER: [
    "event:manage",
    "event:publish",
    "event:cancel",
    "ticket:manage",
    "attendee:read",
    "attendee:lookup",
    "checkin:perform",
    "audit:read",
  ],
  CHECKIN: ["attendee:lookup", "checkin:perform"],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

export function assertCan(role: Role, capability: Capability): void {
  if (!can(role, capability)) {
    throw new Error(`Role ${role} cannot ${capability}`);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Event manager",
  CHECKIN: "Check-in staff",
};

export function isRole(value: string): value is Role {
  return value === "OWNER" || value === "MANAGER" || value === "CHECKIN";
}
