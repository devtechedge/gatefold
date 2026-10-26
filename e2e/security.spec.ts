import { test, expect } from "@playwright/test";

test("health is minimal, headers are present, and protected surfaces are gated", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const healthBody = await health.json();
  expect(healthBody.status).toBe("ok");
  expect(healthBody.database).toBe("up");
  expect(Object.keys(healthBody).sort()).toEqual(["checkedAt", "database", "status", "version"]);
  const serialized = JSON.stringify(healthBody).toLowerCase();
  expect(serialized).not.toContain("neon");
  expect(serialized).not.toContain("postgres");
  expect(serialized).not.toContain("host");

  const home = await request.get("/");
  expect(home.status()).toBe(200);
  const headers = home.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["x-dns-prefetch-control"]).toBe("off");

  const guarded = await request.get("/organizer", { maxRedirects: 0 });
  expect([302, 307]).toContain(guarded.status());
  expect(guarded.headers()["location"]).toContain("/login");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /organizer");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<urlset");
});

test("maintenance expiry requires the configured bearer token", async ({ request }) => {
  const denied = await request.post("/api/internal/expire-holds", {
    headers: { authorization: "Bearer wrong-token" },
  });
  expect(denied.status()).toBe(401);

  const secret = process.env.CRON_SECRET;
  expect(secret, "CRON_SECRET must be available to the test runner").toBeTruthy();
  const accepted = await request.post("/api/internal/expire-holds", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(accepted.status()).toBe(200);
  const body = await accepted.json();
  expect(typeof body.expired).toBe("number");
});
