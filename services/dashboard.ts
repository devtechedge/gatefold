import { prisma } from "@/lib/db";

export interface DashboardEvent {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string;
  artwork: string;
  timezone: string;
  nextStart: Date | null;
  capacity: number;
  sold: number;
  held: number;
  ticketTypes: number;
}

export async function organizerDashboard(organizerId: string) {
  const events = await prisma.event.findMany({
    where: { organizerId },
    orderBy: { createdAt: "desc" },
    include: {
      occurrences: { orderBy: { startsAt: "asc" }, select: { startsAt: true, status: true } },
      ticketTypes: {
        where: { status: "ACTIVE" },
        include: { inventories: { select: { capacity: true, held: true, sold: true } } },
      },
    },
    take: 100,
  });

  const mapped: DashboardEvent[] = events.map((event) => {
    const capacity = event.ticketTypes.reduce(
      (sum, type) => sum + type.inventories.reduce((rowSum, row) => rowSum + row.capacity, 0),
      0
    );
    const sold = event.ticketTypes.reduce(
      (sum, type) => sum + type.inventories.reduce((rowSum, row) => rowSum + row.sold, 0),
      0
    );
    const held = event.ticketTypes.reduce(
      (sum, type) => sum + type.inventories.reduce((rowSum, row) => rowSum + row.held, 0),
      0
    );
    const next = event.occurrences.find(
      (occurrence) => occurrence.status === "SCHEDULED" && occurrence.startsAt.getTime() > Date.now()
    );
    return {
      id: event.id,
      title: event.title,
      slug: event.slug,
      status: event.status,
      category: event.category,
      artwork: event.artwork,
      timezone: event.timezone,
      nextStart: next?.startsAt ?? null,
      capacity,
      sold,
      held,
      ticketTypes: event.ticketTypes.length,
    };
  });

  const [checkedIn, pendingHolds, recentAudit] = await Promise.all([
    prisma.checkIn.count({
      where: { ticket: { reservationLine: { occurrence: { event: { organizerId } } } } },
    }),
    prisma.reservation.count({ where: { organizerId, state: "PENDING_HOLD" } }),
    prisma.auditEvent.findMany({
      where: { organizerId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { displayName: true } } },
    }),
  ]);

  const upcoming = mapped
    .filter((event) => event.status === "PUBLISHED" && event.nextStart)
    .sort((a, b) => (a.nextStart!.getTime() ?? 0) - (b.nextStart!.getTime() ?? 0));

  return {
    events: mapped,
    stats: {
      totalEvents: mapped.length,
      published: mapped.filter((event) => event.status === "PUBLISHED").length,
      drafts: mapped.filter((event) => event.status === "DRAFT").length,
      cancelled: mapped.filter((event) => event.status === "CANCELLED").length,
      ticketsSold: mapped.reduce((sum, event) => sum + event.sold, 0),
      ticketsHeld: mapped.reduce((sum, event) => sum + event.held, 0),
      checkedIn,
      pendingHolds,
    },
    upcoming: upcoming.slice(0, 4),
    lowInventory: upcoming
      .map((event) => ({ ...event, remaining: event.capacity - event.sold - event.held }))
      .filter((event) => event.remaining > 0 && event.remaining <= 5)
      .slice(0, 4),
    recentAudit,
  };
}
