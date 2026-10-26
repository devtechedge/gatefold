import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile();
} catch {
  // CI supplies environment variables.
}

const testDatabase = process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL_TEST ?? "";
const testDatabaseUnpooled =
  process.env.DATABASE_URL_E2E_UNPOOLED ?? process.env.DATABASE_URL_TEST_UNPOOLED ?? testDatabase;
if (!testDatabase) {
  throw new Error("E2E tests require DATABASE_URL_E2E (or DATABASE_URL_TEST in CI).");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CI ? { channel: "chrome" } : {}),
      },
    },
  ],
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: testDatabase,
      DATABASE_URL_UNPOOLED: testDatabaseUnpooled,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      SESSION_PEPPER: process.env.SESSION_PEPPER ?? "",
      TICKET_SIGNING_SECRET: process.env.TICKET_SIGNING_SECRET ?? "",
      CRON_SECRET: process.env.CRON_SECRET ?? "",
    },
  },
});
