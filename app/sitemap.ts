import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${env.siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${env.siteUrl}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${env.siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${env.siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${env.siteUrl}/accessibility`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...staticPages,
    ...events.map((event) => ({
      url: `${env.siteUrl}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
