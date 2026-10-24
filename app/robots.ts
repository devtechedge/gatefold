import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/events", "/events/", "/terms", "/privacy", "/accessibility"],
        disallow: ["/organizer", "/checkout/", "/reservation/", "/ticket/", "/invite/", "/api/"],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
