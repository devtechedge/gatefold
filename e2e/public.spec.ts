import { test, expect } from "@playwright/test";

test("catalogue filters work and the public pages fit a phone", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "All events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Night Market Sessions" })).toBeVisible();

  await page.selectOption("#category", "Music");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/category=Music/);
  await expect(page.getByRole("heading", { name: "Night Market Sessions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paper Trails Zine Fair" })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/events?category=Music");
  const catalogueOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(catalogueOverflow).toBeLessThanOrEqual(0);

  await page.goto("/events/night-market-sessions");
  const eventOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(eventOverflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("heading", { name: "Night Market Sessions" })).toBeVisible();
  await expect(page.getByText("Ticket types", { exact: true }).first()).toBeVisible();
});

test("an expired-looking empty catalogue explains itself", async ({ page }) => {
  await page.goto("/events?q=this-event-does-not-exist");
  await expect(page.getByText("No published events match those filters.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reset the filters" })).toBeVisible();
});

test("no horizontal overflow from 320 to 1440 CSS pixels", async ({ page }) => {
  const paths = [
    "/",
    "/events",
    "/events/night-market-sessions",
    "/login",
    "/reservation",
    "/ticket/GF-7K2M-9Q4X-3B8N-6T1V-5W0Z",
  ];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});
