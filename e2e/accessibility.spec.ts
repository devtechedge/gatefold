import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  const summary = blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target),
  }));
  expect(summary, `${path} accessibility violations`).toEqual([]);
}

test("public surfaces have no serious or critical axe findings", async ({ page }) => {
  for (const path of [
    "/",
    "/events",
    "/events/night-market-sessions",
    "/login",
    "/register",
    "/reservation",
    "/terms",
    "/privacy",
    "/accessibility",
    "/ticket/GF-7K2M-9Q4X-3B8N-6T1V-5W0Z",
  ]) {
    await audit(page, path);
  }
});

test("organizer surfaces have no serious or critical axe findings", async ({ page }) => {
  await page.goto("/login?next=/organizer");
  await page.fill("#login-email", "demo@gatefold.test");
  await page.fill("#login-password", "demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/localhost:3100\/organizer$/);

  const eventHref = await page
    .getByRole("row", { name: /Night Market Sessions/ })
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  expect(eventHref).toBeTruthy();

  for (const path of [
    "/organizer",
    eventHref!,
    `${eventHref}/tickets`,
    `${eventHref}/attendees`,
    `${eventHref}/check-in`,
    `${eventHref}/staff`,
    "/organizer/team",
    "/organizer/settings",
    "/organizer/account",
    "/organizer/events/new",
  ]) {
    await audit(page, path);
  }
});
