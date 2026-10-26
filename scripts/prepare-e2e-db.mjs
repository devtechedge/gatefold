import { execFileSync } from "node:child_process";
import { Client } from "pg";

try {
  process.loadEnvFile();
} catch {
  // CI supplies the environment directly.
}

const pooled = process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL_TEST;
const unpooled = process.env.DATABASE_URL_E2E_UNPOOLED ?? process.env.DATABASE_URL_TEST_UNPOOLED ?? pooled;
if (!pooled || !unpooled) {
  throw new Error("E2E preparation requires DATABASE_URL_E2E (or DATABASE_URL_TEST in CI).");
}
const database = new URL(unpooled).pathname.replace(/^\//, "");
if (!database.includes("e2e") && !database.includes("test")) {
  throw new Error(`Refusing to prepare "${database}" for browser tests.`);
}

const cleanup = new Client({ connectionString: unpooled });
await cleanup.connect();
await cleanup.query(
  "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
  [database]
);
await cleanup.end();

const env = {
  ...process.env,
  DATABASE_URL: pooled,
  DATABASE_URL_UNPOOLED: unpooled,
  ALLOW_PROD_SEED: "1",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
};
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
console.log(`Preparing browser-test database ${database}.`);
execFileSync(npx, ["prisma", "migrate", "deploy"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
execFileSync(npx, ["tsx", "scripts/seed-demo.ts"], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
