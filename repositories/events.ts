import { prisma } from "@/lib/db";

export interface CatalogueFilters {
  q: string;
  category: string;
  from: string;
  to: string;
  price: "ALL" | "FREE" | "UNDER_25" | "25_50" | "OVER_50";
  availability: "ALL" | "AVAILABLE";
  offset: number;
  take: number;
}

export interface CatalogueRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  artwork: string;
  timezone: string;
  organizerName: string;
  venueName: string;
  venueAddress: string;
  nextStart: Date;
  minPrice: number;
  remaining: number;
  currency: string;
}

function dateParam(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function catalogue(filters: CatalogueFilters): Promise<{
  rows: CatalogueRow[];
  hasMore: boolean;
}> {
  const pattern = filters.q ? `%${filters.q}%` : "%";
  const from = dateParam(filters.from);
  const to = dateParam(filters.to);
  const rows = await prisma.$queryRaw<CatalogueRow[]>`
    SELECT e.id, e.slug, e.title, e.category, e.artwork, e.timezone,
           org.name AS "organizerName", v.name AS "venueName", v.address AS "venueAddress",
           MIN(o."startsAt") AS "nextStart",
           MIN(tt."priceMinor") AS "minPrice",
           SUM(GREATEST(ti.capacity - ti.held - ti.sold, 0))::int AS "remaining",
           MIN(tt.currency) AS currency
    FROM event e
    JOIN organizer org ON org.id = e."organizerId"
    JOIN venue v ON v.id = e."venueId"
    JOIN event_occurrence o ON o."eventId" = e.id
    JOIN ticket_inventory ti ON ti."occurrenceId" = o.id
    JOIN ticket_type tt ON tt.id = ti."ticketTypeId"
    WHERE e.status = 'PUBLISHED'
      AND o.status = 'SCHEDULED'
      AND o."startsAt" > now()
      AND tt.status = 'ACTIVE'
      AND tt.visibility = 'PUBLIC'
      AND (${filters.q} = '' OR e.title ILIKE ${pattern} OR e.description ILIKE ${pattern} OR org.name ILIKE ${pattern})
      AND (${filters.category} = '' OR e.category = ${filters.category})
      AND (${from}::timestamptz IS NULL OR o."startsAt" >= ${from})
      AND (${to}::timestamptz IS NULL OR o."startsAt" < (${to}::timestamptz + interval '1 day'))
    GROUP BY e.id, org.name, v.name, v.address
    HAVING (${filters.availability} = 'ALL' OR SUM(GREATEST(ti.capacity - ti.held - ti.sold, 0)) > 0)
       AND (
         ${filters.price} = 'ALL'
         OR (${filters.price} = 'FREE' AND MIN(tt."priceMinor") = 0)
         OR (${filters.price} = 'UNDER_25' AND MIN(tt."priceMinor") < 2500)
         OR (${filters.price} = '25_50' AND MIN(tt."priceMinor") >= 2500 AND MIN(tt."priceMinor") <= 5000)
         OR (${filters.price} = 'OVER_50' AND MIN(tt."priceMinor") > 5000)
       )
    ORDER BY "nextStart" ASC, e.id ASC
    LIMIT ${filters.take + 1} OFFSET ${filters.offset}
  `;
  return { rows: rows.slice(0, filters.take), hasMore: rows.length > filters.take };
}

export async function findBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: true,
      venue: true,
      occurrences: {
        where: { status: "SCHEDULED" },
        orderBy: { startsAt: "asc" },
        include: { inventories: true },
      },
      ticketTypes: {
        where: { status: "ACTIVE", visibility: "PUBLIC" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function organizerEvents(organizerId: string) {
  return prisma.event.findMany({
    where: { organizerId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      occurrences: { orderBy: { startsAt: "asc" }, take: 1 },
      ticketTypes: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
}

export async function eventForOrganizer(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      venue: true,
      occurrences: {
        orderBy: { startsAt: "asc" },
        include: { inventories: { include: { ticketType: true } } },
      },
      ticketTypes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}
