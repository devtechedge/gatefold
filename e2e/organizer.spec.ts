import { test, expect } from "@playwright/test";

test("an owner creates an event, adds tickets, and publishes it", async ({ page }) => {
  const title = `E2E Assembly ${Date.now()}`;
  await page.goto("/login?next=/organizer");
  await page.fill("#login-email", "demo@gatefold.test");
  await page.fill("#login-password", "demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/localhost:3100\/organizer$/);
  await expect(page.getByRole("heading", { name: "Fold & Field" })).toBeVisible();

  await page.getByRole("link", { name: "New event" }).first().click();
  await page.waitForURL(/\/organizer\/events\/new$/);
  await page.fill("#title", title);
  await page.fill(
    "#description",
    "A full organizer journey created by the browser test. It must be long enough to pass validation."
  );
  await page.selectOption("#category", "Workshops");
  await page.fill("#venueName", "Test Assembly Hall");
  await page.fill("#venueAddress", "22 Test Lane, Brooklyn, NY 11201");
  await page.getByRole("button", { name: "Create draft event" }).click();
  await page.waitForURL(/\/organizer\/events\/(?!new)[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const eventNav = page.getByRole("navigation", { name: "Event sections" });
  await eventNav.getByRole("link", { name: "Tickets", exact: true }).click();
  await page.waitForURL(/\/tickets$/);
  await page.fill("#ticket-label", "Assembly seat");
  await page.fill("#ticket-price", "20");
  await page.fill("#ticket-capacity", "10");
  await page.fill("#ticket-description", "One seat at the assembly.");
  await page.getByRole("button", { name: "Add ticket type" }).click();
  await expect(page.getByText("Ticket type added to every occurrence.")).toBeVisible();

  await eventNav.getByRole("link", { name: "Overview", exact: true }).click();
  await page.waitForURL(/\/organizer\/events\/[^/]+$/);
  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page.getByText("Event published.")).toBeVisible();

  await expect(page.getByRole("link", { name: "Public page" })).toBeVisible();
  await page.getByRole("link", { name: "Public page" }).click();
  await page.waitForURL(/\/events\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("$20", { exact: false }).first()).toBeVisible();
});

test("check-in staff cannot reach team, settings, tickets, or attendee lists", async ({ page }) => {
  await page.goto("/login?next=/organizer");
  await page.fill("#login-email", "staff@gatefold.test");
  await page.fill("#login-password", "demo-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/localhost:3100\/organizer$/);

  await page.goto("/organizer/team");
  await page.waitForURL(/localhost:3100\/organizer$/);
  await page.goto("/organizer/settings");
  await page.waitForURL(/localhost:3100\/organizer$/);

  const nightMarketRow = page.getByRole("row", { name: /Night Market Sessions/ });
  await nightMarketRow.getByRole("link", { name: "Open" }).click();
  await page.waitForURL(/\/check-in/);
  await expect(page.getByRole("heading", { name: "The door." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tickets", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Attendees", exact: true })).toHaveCount(0);
});
