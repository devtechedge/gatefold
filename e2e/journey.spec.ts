import { test, expect } from "@playwright/test";

test("a visitor books, checks out, gets a ticket, and staff can only admit it once", async ({
  page,
  browser,
}) => {
  const buyerEmail = `journey-${Date.now()}@example.test`;
  await page.goto("/events/night-market-sessions");
  await page.getByRole("button", { name: "Add one General admission" }).click();
  await page.fill("#buyer-name", "Journey Buyer");
  await page.fill("#buyer-email", buyerEmail);

  await page.getByRole("button", { name: "Hold these tickets" }).click();
  await page.waitForURL(/\/checkout\//, { timeout: 30_000 });
  await expect(page.getByText("Demo checkout", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Complete demo checkout" }).click();
  await page.waitForURL(/\/reservation\//, { timeout: 30_000 });
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open ticket" }).first()).toBeVisible();

  const ticketHref = await page.getByRole("link", { name: "Open ticket" }).first().getAttribute("href");
  expect(ticketHref).toMatch(/^\/ticket\/GF-/);
  await page.goto(ticketHref!);
  await expect(page.locator('img[alt^="Signed QR code"]')).toBeVisible();
  const code = (await page.locator("p.mono").first().innerText()).trim();
  expect(code).toMatch(/^GF-/);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header")).toBeHidden();
  await expect(page.locator("footer")).toBeHidden();
  await expect(page.locator(".ticket-print")).toBeVisible();
  await expect(page.locator('img[alt^="Signed QR code"]')).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staff = await staffContext.newPage();
  await staff.goto("/login?next=/organizer");
  await staff.fill("#login-email", "staff@gatefold.test");
  await staff.fill("#login-password", "demo-password-1");
  await staff.getByRole("button", { name: "Sign in" }).click();
  await staff.waitForURL(/localhost:3100\/organizer$/);

  const nightMarketRow = staff.getByRole("row", { name: /Night Market Sessions/ });
  await nightMarketRow.getByRole("link", { name: "Open" }).click();
  await staff.waitForURL(/\/check-in/);
  await expect(staff.getByRole("heading", { name: "The door." })).toBeVisible();
  const checkInOverflow = await staff.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(checkInOverflow).toBeLessThanOrEqual(0);

  await staff.fill("#manual-code", code);
  await staff.getByRole("button", { name: "Verify ticket" }).click();
  await expect(staff.getByText("Hand over the wristband.")).toBeVisible({ timeout: 20_000 });

  await staff.getByRole("button", { name: "Scan next" }).click();
  await staff.fill("#manual-code", code);
  await staff.getByRole("button", { name: "Verify ticket" }).click();
  await expect(staff.getByText(/Already checked in at/)).toBeVisible({ timeout: 20_000 });

  await staffContext.close();
});
