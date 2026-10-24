const DEFAULT_SITE_URL = "http://localhost:3000";

try {
  process.loadEnvFile();
} catch {
  // Environment is provided by the platform in CI and production.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  sessionPepper: required("SESSION_PEPPER"),
  ticketSigningSecret: required("TICKET_SIGNING_SECRET"),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, ""),
  cronSecret: process.env.CRON_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

export function siteUrl(): string {
  return env.siteUrl;
}
