import { z } from "zod";
import { ARTWORKS, CATEGORIES } from "@/domain/types";
import { validTimeZone } from "@/lib/dates";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const timeZone = z.string().trim().refine(validTimeZone, "Choose a valid timezone.");

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email,
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(200),
    newPassword: z.string().min(10, "Use at least 10 characters.").max(200),
    confirmPassword: z.string().min(10, "Confirm the new password.").max(200),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "The new passwords do not match.",
    path: ["confirmPassword"],
  });

export const organizerCreateSchema = z.object({
  name: z.string().trim().min(2, "Organizer name is required.").max(100),
});

export const organizerSettingsSchema = z.object({
  name: z.string().trim().min(2, "Organizer name is required.").max(100),
  venueName: z.string().trim().max(120).optional(),
  venueAddress: z.string().trim().max(300).optional(),
  venueTimezone: timeZone.optional(),
  accessibility: z.string().trim().max(1000).optional(),
});

const localDateTime = z.string().trim().min(10, "Choose a date and time.");

export const eventCreateSchema = z
  .object({
    title: z.string().trim().min(3, "Give the event a title.").max(140),
    description: z.string().trim().min(20, "Write at least 20 characters.").max(6000),
    category: z.enum(CATEGORIES),
    artwork: z.enum(ARTWORKS),
    timezone: timeZone,
    venueName: z.string().trim().min(2, "Venue name is required.").max(120),
    venueAddress: z.string().trim().min(4, "Venue address is required.").max(300),
    accessibility: z.string().trim().max(1000).default(""),
    occurrences: z
      .array(
        z.object({
          startsAtLocal: localDateTime,
          endsAtLocal: localDateTime,
          label: z.string().trim().max(80).default(""),
        })
      )
      .min(1, "Add at least one occurrence.")
      .max(8, "An event can have at most eight occurrences."),
  })
  .refine(
    (value) => value.occurrences.every((o) => new Date(o.endsAtLocal) > new Date(o.startsAtLocal)),
    { message: "Each occurrence must end after it starts.", path: ["occurrences"] }
  );

export const eventUpdateSchema = z.object({
  title: z.string().trim().min(3, "Give the event a title.").max(140),
  description: z.string().trim().min(20, "Write at least 20 characters.").max(6000),
  category: z.enum(CATEGORIES),
  artwork: z.enum(ARTWORKS),
  accessibility: z.string().trim().max(1000).default(""),
});

const priceInput = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a price such as 24 or 24.50.");

export const ticketTypeCreateSchema = z.object({
  label: z.string().trim().min(2, "Name the ticket type.").max(80),
  description: z.string().trim().max(400).default(""),
  price: priceInput,
  capacity: z.coerce.number().int("Capacity must be a whole number.").min(1, "Capacity must be at least 1.").max(10000),
  salesStartLocal: z.string().trim().max(40).optional(),
  salesEndLocal: z.string().trim().max(40).optional(),
});

export const ticketTypeUpdateSchema = z.object({
  label: z.string().trim().min(2, "Name the ticket type.").max(80),
  description: z.string().trim().max(400).default(""),
  price: priceInput,
  salesStartLocal: z.string().trim().max(40).optional(),
  salesEndLocal: z.string().trim().max(40).optional(),
});

export const capacityUpdateSchema = z.object({
  inventoryId: z.string().trim().min(1),
  capacity: z.coerce.number().int("Capacity must be a whole number.").min(0).max(10000),
});

export const reservationCreateSchema = z.object({
  eventId: z.string().trim().min(1),
  occurrenceId: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().trim().min(1),
        quantity: z.coerce.number().int().min(1, "Choose at least one ticket.").max(20),
      })
    )
    .min(1, "Choose at least one ticket.")
    .max(8),
  buyer: z.object({
    name: z.string().trim().min(2, "Enter the buyer name.").max(120),
    email,
    phone: z.string().trim().max(40).default(""),
  }),
});

export const attendeeSchema = z.object({
  name: z.string().trim().min(1, "Attendee name is required.").max(120),
  email: email.optional(),
});

export const checkoutSchema = z.object({
  attendees: z
    .array(
      z.object({
        lineId: z.string().trim().min(1),
        names: z.array(z.string().trim().max(120)).max(20),
      })
    )
    .max(8)
    .optional(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const verifySchema = z.object({
  payload: z.string().trim().min(1, "Enter or scan a ticket code.").max(400),
  eventId: z.string().trim().min(1).optional(),
  gateLabel: z.string().trim().max(80).default(""),
  method: z.enum(["SCAN", "MANUAL"]).default("SCAN"),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(["MANAGER", "CHECKIN"]),
});

export const attendeeSearchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  state: z.enum(["ALL", "PENDING_HOLD", "CONFIRMED", "CANCELLED", "EXPIRED"]).default("ALL"),
  cursor: z.string().trim().max(80).optional(),
  take: z.coerce.number().int().min(1).max(50).default(25),
});

export const eventListSchema = z.object({
  q: z.string().trim().max(120).default(""),
  category: z.string().trim().max(40).default(""),
  from: z.string().trim().max(20).default(""),
  to: z.string().trim().max(20).default(""),
  price: z.enum(["ALL", "FREE", "UNDER_25", "25_50", "OVER_50"]).default("ALL"),
  availability: z.enum(["ALL", "AVAILABLE"]).default("ALL"),
  cursor: z.string().trim().max(80).optional(),
  take: z.coerce.number().int().min(1).max(24).default(12),
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
