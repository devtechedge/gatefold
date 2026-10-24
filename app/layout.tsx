import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/400.css";
import "./globals.css";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Gatefold - independent event operations",
    template: "%s - Gatefold",
  },
  description:
    "Publish events, hold ticket inventory safely, issue tickets, and check people in. Gatefold is an event operations platform with a simulated checkout.",
  applicationName: "Gatefold",
  openGraph: {
    type: "website",
    siteName: "Gatefold",
    title: "Gatefold - independent event operations",
    description:
      "Event publishing, honest inventory, issued tickets, and a check-in desk that holds up under pressure.",
    url: env.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gatefold - independent event operations",
    description: "Publishing, inventory, tickets, and check-in for independent organizers.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#141118" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeBoot = `try{var t=localStorage.getItem("gatefold-theme");if(t==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
