"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requirePageUser } from "@/lib/auth/session";
import { eventAccess, requireMembershipForPage } from "@/lib/auth/organizer";
import { HttpError } from "@/lib/errors";
import { can, type Capability, type Role } from "@/domain/permissions";
import {
  eventCreateSchema,
  eventUpdateSchema,
  organizerCreateSchema,
  organizerSettingsSchema,
  ticketTypeCreateSchema,
  ticketTypeUpdateSchema,
  inviteSchema,
} from "@/validation/schemas";
import {
  createEvent,
  updateEvent,
  publishEvent,
  unpublishEvent,
  cancelEvent,
  addTicketType,
  updateTicketType,
  setTicketTypeStatus,
  setTicketTypeVisibility,
  updateCapacity,
} from "@/services/events";
import {
  createOrganizerForUser,
  updateOrganizerSettings,
  inviteMember,
  updateMemberRole,
  removeMember,
  deleteOwnAccount,
} from "@/services/auth";
import { cancelReservationAsOrganizer } from "@/services/reservations";
import type { ActionState } from "@/lib/action-state";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toError(error: unknown): ActionState {
  if (error instanceof HttpError) return { error: error.message };
  throw error;
}

async function pageContext(capability: Capability) {
  const user = await requirePageUser("/organizer");
  const membership = await requireMembershipForPage(user.id);
  if (!membership) redirect("/organizer/new");
  const role = membership.role as Role;
  if (!can(role, capability)) {
    throw new HttpError("FORBIDDEN", "Your role does not allow that action.", 403);
  }
  return { user, membership, organizerId: membership.organizerId };
}

export async function createOrganizerAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePageUser("/organizer");
  const existing = await requireMembershipForPage(user.id);
  if (existing) redirect("/organizer");
  const parsed = organizerCreateSchema.safeParse({ name: text(formData, "name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name." };
  try {
    await createOrganizerForUser(user.id, parsed.data.name);
  } catch (error) {
    return toError(error);
  }
  revalidatePath("/organizer");
  redirect("/organizer");
}

export async function createEventAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user, organizerId } = await pageContext("event:manage");
  const starts = formData.getAll("occurrenceStart").filter((value): value is string => typeof value === "string");
  const ends = formData.getAll("occurrenceEnd").filter((value): value is string => typeof value === "string");
  const labels = formData.getAll("occurrenceLabel").filter((value): value is string => typeof value === "string");
  const occurrences = starts.map((start, index) => ({
    startsAtLocal: start,
    endsAtLocal: ends[index] ?? "",
    label: labels[index] ?? "",
  }));
  const parsed = eventCreateSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    artwork: text(formData, "artwork"),
    timezone: text(formData, "timezone"),
    venueName: text(formData, "venueName"),
    venueAddress: text(formData, "venueAddress"),
    accessibility: text(formData, "accessibility"),
    occurrences,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the event details." };
  let created: { id: string; slug: string };
  try {
    created = await createEvent(parsed.data, organizerId, user.id);
  } catch (error) {
    return toError(error);
  }
  revalidatePath("/events");
  redirect(`/organizer/events/${created.id}`);
}

export async function updateEventAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("event:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "event:manage");
  const parsed = eventUpdateSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    artwork: text(formData, "artwork"),
    accessibility: text(formData, "accessibility"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the event details." };
  try {
    await updateEvent(eventId, access.event.organizerId, user.id, parsed.data);
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}`);
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Event details saved." };
}

export async function publishEventAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("event:publish");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "event:publish");
  try {
    await publishEvent(eventId, access.event.organizerId, user.id);
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Event published." };
}

export async function unpublishEventAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("event:publish");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "event:publish");
  try {
    await unpublishEvent(eventId, access.event.organizerId, user.id);
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Event returned to draft." };
}

export async function cancelEventAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("event:cancel");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "event:cancel");
  try {
    await cancelEvent(eventId, access.event.organizerId, user.id, text(formData, "reason"));
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Event cancelled. Every issued ticket is void." };
}

export async function addTicketTypeAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("ticket:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "ticket:manage");
  const parsed = ticketTypeCreateSchema.safeParse({
    label: text(formData, "label"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    capacity: text(formData, "capacity"),
    salesStartLocal: text(formData, "salesStartLocal") || undefined,
    salesEndLocal: text(formData, "salesEndLocal") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the ticket details." };
  try {
    await addTicketType({
      eventId,
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      ...parsed.data,
      capacity: Number(parsed.data.capacity),
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}/tickets`);
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Ticket type added to every occurrence." };
}

export async function updateTicketTypeAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("ticket:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "ticket:manage");
  const parsed = ticketTypeUpdateSchema.safeParse({
    label: text(formData, "label"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    salesStartLocal: text(formData, "salesStartLocal") || undefined,
    salesEndLocal: text(formData, "salesEndLocal") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the ticket details." };
  try {
    await updateTicketType({
      ticketTypeId: text(formData, "ticketTypeId"),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      ...parsed.data,
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}/tickets`);
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Ticket type updated. New prices apply to future reservations." };
}

export async function setTicketStatusAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("ticket:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "ticket:manage");
  const status = text(formData, "status") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
  try {
    await setTicketTypeStatus({
      ticketTypeId: text(formData, "ticketTypeId"),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      status,
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}/tickets`);
  revalidatePath(`/events/${access.event.slug}`);
  return { message: status === "ARCHIVED" ? "Ticket type archived." : "Ticket type reactivated." };
}

export async function setTicketVisibilityAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("ticket:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "ticket:manage");
  const visibility = text(formData, "visibility") === "HIDDEN" ? "HIDDEN" : "PUBLIC";
  try {
    await setTicketTypeVisibility({
      ticketTypeId: text(formData, "ticketTypeId"),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      visibility,
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}/tickets`);
  revalidatePath(`/events/${access.event.slug}`);
  return {
    message: visibility === "HIDDEN" ? "Ticket type hidden from public sale." : "Ticket type visible on the public page.",
  };
}

export async function updateCapacityAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("ticket:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "ticket:manage");
  try {
    await updateCapacity({
      inventoryId: text(formData, "inventoryId"),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      capacity: Number(text(formData, "capacity")),
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}/tickets`);
  revalidatePath(`/events/${access.event.slug}`);
  return { message: "Capacity updated." };
}

export async function cancelReservationAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await pageContext("event:manage");
  const eventId = text(formData, "eventId");
  const access = await eventAccess(user.id, eventId, "event:manage");
  try {
    await cancelReservationAsOrganizer({
      reservationId: text(formData, "reservationId"),
      organizerId: access.event.organizerId,
      actorUserId: user.id,
      reason: text(formData, "reason") || "Cancelled by organizer",
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath(`/organizer/events/${eventId}/attendees`);
  return { message: "Reservation cancelled and its tickets voided." };
}

export async function updateOrganizerSettingsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user, organizerId } = await pageContext("organizer:manage");
  const parsed = organizerSettingsSchema.safeParse({
    name: text(formData, "name"),
    venueName: text(formData, "venueName") || undefined,
    venueAddress: text(formData, "venueAddress") || undefined,
    venueTimezone: text(formData, "venueTimezone") || undefined,
    accessibility: text(formData, "accessibility") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings." };
  try {
    await updateOrganizerSettings({
      organizerId,
      actorUserId: user.id,
      name: parsed.data.name,
      venueName: parsed.data.venueName,
      venueAddress: parsed.data.venueAddress,
      venueTimezone: parsed.data.venueTimezone,
      accessibility: parsed.data.accessibility,
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath("/organizer/settings");
  revalidatePath("/organizer");
  return { message: "Organizer settings saved." };
}

export async function deleteAccountAction(): Promise<ActionState> {
  const user = await requirePageUser("/organizer/account");
  try {
    await deleteOwnAccount(user.id);
  } catch (error) {
    return toError(error);
  }
  await destroySession();
  redirect("/");
}

export async function inviteMemberAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user, organizerId } = await pageContext("team:manage");
  const parsed = inviteSchema.safeParse({
    email: text(formData, "email"),
    role: text(formData, "role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invitation." };
  try {
    const invitation = await inviteMember({
      organizerId,
      actorUserId: user.id,
      email: parsed.data.email,
      role: parsed.data.role,
    });
    revalidatePath("/organizer/team");
    return {
      message: "Invitation created. Email is not sent in this demo, so share this link directly.",
      link: `/invite/${invitation.token}`,
    };
  } catch (error) {
    return toError(error);
  }
}

export async function updateMemberRoleAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user, organizerId } = await pageContext("team:manage");
  try {
    await updateMemberRole({
      organizerId,
      actorUserId: user.id,
      membershipId: text(formData, "membershipId"),
      role: text(formData, "role") === "MANAGER" ? "MANAGER" : "CHECKIN",
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath("/organizer/team");
  return { message: "Role updated." };
}

export async function removeMemberAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user, organizerId } = await pageContext("team:manage");
  try {
    await removeMember({
      organizerId,
      actorUserId: user.id,
      membershipId: text(formData, "membershipId"),
    });
  } catch (error) {
    return toError(error);
  }
  revalidatePath("/organizer/team");
  return { message: "Team member removed." };
}
