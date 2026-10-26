import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { createHold, requireReservationByRef, cancelReservationByRef } from "../services/reservations";
import { demoCheckout } from "../services/checkout";
import { publishEvent, cancelEvent } from "../services/events";
import { verifyTicket } from "../services/checkin";
import { inviteMember } from "../services/auth";
import { ticketQrPayload } from "../domain/ticket";

const DEMO_TICKET_ID = "GF-7K2M-9Q4X-3B8N-6T1V-5W0Z";
const TZ = "America/New_York";

function guard(): string {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  const database = new URL(url).pathname.replace(/^\//, "");
  if (!["gatefold", "gatefold_test", "gatefold_e2e"].includes(database)) {
    throw new Error(`Refusing to seed unrecognised database "${database}".`);
  }
  if (database === "gatefold" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error("Refusing to seed the production database without ALLOW_PROD_SEED=1.");
  }
  return database;
}

function inDays(days: number, time: string, timeZone = TZ): Date {
  const day = formatInTimeZone(new Date(Date.now() + days * 24 * 60 * 60 * 1000), timeZone, "yyyy-MM-dd");
  return fromZonedTime(`${day}T${time}`, timeZone);
}

async function main() {
  const database = guard();
  console.log(`Seeding ${database} with the Gatefold demo.`);

  const previous = await prisma.organizer.findUnique({ where: { slug: "fold-and-field" } });
  if (previous) {
    // Reservation history is deliberately restrictive, so remove it before its events.
    await prisma.reservation.deleteMany({ where: { organizerId: previous.id } });
    await prisma.event.deleteMany({ where: { organizerId: previous.id } });
    await prisma.organizer.delete({ where: { id: previous.id } });
  }
  await prisma.rateLimit.deleteMany({});
  await prisma.idempotencyRecord.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["demo@gatefold.test", "manager@gatefold.test", "staff@gatefold.test"],
      },
    },
  });

  const passwordHash = await hashPassword("demo-password-1");
  const owner = await prisma.user.create({
    data: { email: "demo@gatefold.test", displayName: "Mira Sol", passwordHash },
  });
  const manager = await prisma.user.create({
    data: { email: "manager@gatefold.test", displayName: "Jonas Pike", passwordHash },
  });
  const staff = await prisma.user.create({
    data: { email: "staff@gatefold.test", displayName: "Rae Lin", passwordHash },
  });

  const organizer = await prisma.organizer.create({
    data: { name: "Fold & Field", slug: "fold-and-field", ownerId: owner.id },
  });
  await prisma.organizerMembership.createMany({
    data: [
      { organizerId: organizer.id, userId: owner.id, role: "OWNER", status: "ACTIVE", acceptedAt: new Date() },
      { organizerId: organizer.id, userId: manager.id, role: "MANAGER", status: "ACTIVE", acceptedAt: new Date() },
      { organizerId: organizer.id, userId: staff.id, role: "CHECKIN", status: "ACTIVE", acceptedAt: new Date() },
    ],
  });

  const paperHall = await prisma.venue.create({
    data: {
      organizerId: organizer.id,
      name: "The Paper Hall",
      address: "14 Lantern Lane, Brooklyn, NY 11201",
      timezone: TZ,
      accessibility: "Step-free entrance on Lantern Lane. Two accessible restrooms. A quiet room is available on the mezzanine.",
    },
  });
  const rooftop = await prisma.venue.create({
    data: {
      organizerId: organizer.id,
      name: "Lantern Rooftop",
      address: "88 Orchard Street, 6th floor, New York, NY 10002",
      timezone: TZ,
      accessibility: "Lift to the fifth floor, then one flight of stairs. Seating can be arranged on the lower level on request.",
    },
  });
  const riverside = await prisma.venue.create({
    data: {
      organizerId: organizer.id,
      name: "Riverside Studio",
      address: "9 Kent Avenue, Brooklyn, NY 11249",
      timezone: TZ,
      accessibility: "Ground-floor studio with a wide doorway. No steps between the street and the main room.",
    },
  });

  async function makeEvent(input: {
    title: string;
    slug: string;
    description: string;
    category: string;
    artwork: string;
    venueId: string;
    occurrences: { start: Date; end: Date; label?: string }[];
    ticketTypes: { label: string; description: string; priceMinor: number; capacity: number }[];
  }) {
    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        venueId: input.venueId,
        title: input.title,
        slug: input.slug,
        description: input.description,
        category: input.category,
        artwork: input.artwork,
        timezone: TZ,
        status: "DRAFT",
        occurrences: {
          create: input.occurrences.map((occurrence) => ({
            startsAt: occurrence.start,
            endsAt: occurrence.end,
            label: occurrence.label ?? "",
          })),
        },
      },
      include: { occurrences: true },
    });
    for (const [index, type] of input.ticketTypes.entries()) {
      const created = await prisma.ticketType.create({
        data: {
          eventId: event.id,
          label: type.label,
          description: type.description,
          priceMinor: type.priceMinor,
          status: "ACTIVE",
          sortOrder: index,
        },
      });
      await prisma.ticketInventory.createMany({
        data: event.occurrences.map((occurrence) => ({
          occurrenceId: occurrence.id,
          ticketTypeId: created.id,
          capacity: type.capacity,
        })),
      });
    }
    return event;
  }

  const nightMarket = await makeEvent({
    title: "Night Market Sessions",
    slug: "night-market-sessions",
    description:
      "Two evenings of low light and long-form listening at The Paper Hall. Record shop tables open at 7:30, live sets begin at 8:30, and the room closes at eleven. Tickets are limited by the room, not by demand, so the front row stays small on purpose.",
    category: "Music",
    artwork: "vermilion",
    venueId: paperHall.id,
    occurrences: [
      { start: inDays(10, "19:30"), end: inDays(10, "23:00"), label: "Friday session" },
      { start: inDays(17, "19:30"), end: inDays(17, "23:00"), label: "Saturday session" },
    ],
    ticketTypes: [
      { label: "Early listening", description: "Entry from 7:30, first pick of the record tables.", priceMinor: 2400, capacity: 12 },
      { label: "General admission", description: "Standing and bench seating throughout the hall.", priceMinor: 3200, capacity: 40 },
      { label: "Front row", description: "Six seats closest to the stage. Three per session.", priceMinor: 6000, capacity: 3 },
    ],
  });

  const zineFair = await makeEvent({
    title: "Paper Trails Zine Fair",
    slug: "paper-trails-zine-fair",
    description:
      "Forty tables of self-published work, risograph demos, and a repair corner for sad staplers. Free to enter. Tables are juried and each one is run by the person who made the work. Bring cash for the small presses and a tote for the big ones.",
    category: "Markets",
    artwork: "lime",
    venueId: paperHall.id,
    occurrences: [{ start: inDays(4, "11:00"), end: inDays(4, "18:00") }],
    ticketTypes: [
      { label: "Free entry", description: "Reserve a free entry pass so we can plan the room.", priceMinor: 0, capacity: 400 },
      { label: "Zine table", description: "One six-foot table, two chairs, and a listing in the programme.", priceMinor: 4500, capacity: 24 },
    ],
  });

  const photoWalk = await makeEvent({
    title: "Analog Photo Walk",
    slug: "analog-photo-walk",
    description:
      "A slow two-hour walk along the waterfront with one roll of film and no phone cameras. We start at Riverside Studio, walk the Kent Avenue stretch, and finish with a contact sheet session. Twelve people would be too many. Two is the whole point.",
    category: "Workshops",
    artwork: "ink",
    venueId: riverside.id,
    occurrences: [{ start: inDays(7, "09:00"), end: inDays(7, "11:30") }],
    ticketTypes: [
      { label: "Walk ticket", description: "Includes one roll of 35mm film and a contact sheet.", priceMinor: 1800, capacity: 2 },
    ],
  });

  const slowType = await makeEvent({
    title: "Slow Type: Letterpress Morning",
    slug: "slow-type-letterpress-morning",
    description:
      "Set a line, lock it up, and print an edition of twelve on the Vandercook. No experience needed and no computer involved. We keep the group at six so everyone leaves with inky fingers and a finished print.",
    category: "Workshops",
    artwork: "cobalt",
    venueId: riverside.id,
    occurrences: [{ start: inDays(21, "10:00"), end: inDays(21, "13:00") }],
    ticketTypes: [
      { label: "Bench seat", description: "One press bench, all materials included.", priceMinor: 3800, capacity: 6 },
    ],
  });

  await makeEvent({
    title: "Rooftop Listening Room",
    slug: "rooftop-listening-room",
    description:
      "A draft for the late-summer series. One turntable, forty chairs, and a strict no-talking rule during side A. This event is deliberately unpublished while the sound permit is confirmed.",
    category: "Music",
    artwork: "rose",
    venueId: rooftop.id,
    occurrences: [{ start: inDays(28, "20:00"), end: inDays(28, "22:30") }],
    ticketTypes: [{ label: "Standard", description: "One chair and one listening session.", priceMinor: 2800, capacity: 30 }],
  });

  const winterSwap = await makeEvent({
    title: "Winter Print Swap",
    slug: "winter-print-swap",
    description:
      "Bring three prints, leave with three different ones. Tables, tape, and warm cider provided. This event was cancelled after the venue lost its heating system for the week.",
    category: "Community",
    artwork: "ink",
    venueId: paperHall.id,
    occurrences: [{ start: inDays(14, "18:00"), end: inDays(14, "21:00") }],
    ticketTypes: [{ label: "Swap table", description: "One table space and three swap tokens.", priceMinor: 1200, capacity: 30 }],
  });

  await publishEvent(nightMarket.id, organizer.id, owner.id);
  await publishEvent(zineFair.id, organizer.id, owner.id);
  await publishEvent(photoWalk.id, organizer.id, owner.id);
  await publishEvent(slowType.id, organizer.id, owner.id);
  await publishEvent(winterSwap.id, organizer.id, owner.id);

  const nightOccurrence = await prisma.eventOccurrence.findFirstOrThrow({
    where: { eventId: nightMarket.id },
    orderBy: { startsAt: "asc" },
  });
  const nightType = await prisma.ticketType.findFirstOrThrow({
    where: { eventId: nightMarket.id, label: "General admission" },
  });

  const ariHold = await createHold({
    eventId: nightMarket.id,
    occurrenceId: nightOccurrence.id,
    items: [{ ticketTypeId: nightType.id, quantity: 2 }],
    buyer: { name: "Ari Voss", email: "ari@example.test", phone: "" },
  });
  const ariBefore = await requireReservationByRef(ariHold.ref);
  const generalLine = ariBefore.lines[0];
  const ari = await demoCheckout(ariHold.ref, [
    { lineId: generalLine.id, names: ["Ari Voss", "Tess Alvi"] },
  ]);
  const firstTicket = ari.tickets[0];
  await prisma.issuedTicket.update({
    where: { publicId: firstTicket.publicId },
    data: { publicId: DEMO_TICKET_ID },
  });
  await verifyTicket({
    payload: ticketQrPayload(DEMO_TICKET_ID),
    staffUserId: staff.id,
    expectedEventId: nightMarket.id,
    gateLabel: "Paper Hall door",
  });

  const walkOccurrence = await prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: photoWalk.id } });
  const walkType = await prisma.ticketType.findFirstOrThrow({ where: { eventId: photoWalk.id } });
  for (const buyer of [
    { name: "Nia Okonkwo", email: "nia@example.test" },
    { name: "Bo Tran", email: "bo@example.test" },
  ]) {
    const hold = await createHold({
      eventId: photoWalk.id,
      occurrenceId: walkOccurrence.id,
      items: [{ ticketTypeId: walkType.id, quantity: 1 }],
      buyer: { ...buyer, phone: "" },
    });
    await demoCheckout(hold.ref);
  }

  const zineOccurrence = await prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: zineFair.id } });
  const freeEntry = await prisma.ticketType.findFirstOrThrow({
    where: { eventId: zineFair.id, label: "Free entry" },
  });

  const cancelledHold = await createHold({
    eventId: zineFair.id,
    occurrenceId: zineOccurrence.id,
    items: [{ ticketTypeId: freeEntry.id, quantity: 1 }],
    buyer: { name: "Ira Sen", email: "ira@example.test", phone: "" },
  });
  await demoCheckout(cancelledHold.ref);
  const cancelled = await cancelReservationByRef(cancelledHold.ref, "Change of plans");

  const pendingHold = await createHold({
    eventId: zineFair.id,
    occurrenceId: zineOccurrence.id,
    items: [{ ticketTypeId: freeEntry.id, quantity: 2 }],
    buyer: { name: "Rowan Vale", email: "rowan@example.test", phone: "" },
  });

  const slowOccurrence = await prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: slowType.id } });
  const slowTicket = await prisma.ticketType.findFirstOrThrow({ where: { eventId: slowType.id } });
  const slowHold = await createHold({
    eventId: slowType.id,
    occurrenceId: slowOccurrence.id,
    items: [{ ticketTypeId: slowTicket.id, quantity: 4 }],
    buyer: { name: "Sam Erdos", email: "sam@example.test", phone: "" },
  });
  await demoCheckout(slowHold.ref);

  const swapOccurrence = await prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: winterSwap.id } });
  const swapTicket = await prisma.ticketType.findFirstOrThrow({ where: { eventId: winterSwap.id } });
  const swapHold = await createHold({
    eventId: winterSwap.id,
    occurrenceId: swapOccurrence.id,
    items: [{ ticketTypeId: swapTicket.id, quantity: 2 }],
    buyer: { name: "Priya Raman", email: "priya@example.test", phone: "" },
  });
  await demoCheckout(swapHold.ref);
  await cancelEvent(winterSwap.id, organizer.id, owner.id, "The venue lost heating for the week. All demo tickets are void and no payment was collected.");

  const invitation = await inviteMember({
    organizerId: organizer.id,
    actorUserId: owner.id,
    email: "newstaff@example.test",
    role: "CHECKIN",
  });

  const soldOut = await prisma.ticketInventory.findFirstOrThrow({
    where: { ticketType: { eventId: photoWalk.id } },
  });

  console.log("");
  console.log("Demo accounts (demo environment only)");
  console.log("  owner     demo@gatefold.test / demo-password-1");
  console.log("  manager   manager@gatefold.test / demo-password-1");
  console.log("  check-in  staff@gatefold.test / demo-password-1");
  console.log("");
  console.log("Demo data");
  console.log(`  organizer      Fold & Field /organizer`);
  console.log(`  stable ticket  /ticket/${DEMO_TICKET_ID}`);
  console.log(`  live hold      /checkout/${pendingHold.ref}`);
  console.log(`  cancelled      /reservation/${cancelled.ref}`);
  console.log(`  cancelled event reservation /reservation/${(await requireReservationByRef(swapHold.ref)).ref}`);
  console.log(`  invitation     /invite/${invitation.token} (newstaff@example.test, expires ${invitation.expiresAt.toISOString()})`);
  console.log(`  sold out       ${soldOut.sold} of ${soldOut.capacity} seats sold on Analog Photo Walk`);
  console.log("");
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
