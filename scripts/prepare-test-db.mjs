import { execFileSync } from "node:child_process";

try {
  process.loadEnvFile();
} catch {
  // CI provides environment variables directly.
}

const testUrl = process.env.DATABASE_URL_TEST_UNPOOLED ?? process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error("DATABASE_URL_TEST_UNPOOLED or DATABASE_URL_TEST is required for integration tests.");
}
const database = new URL(testUrl).pathname.replace(/^\//, "");
if (!database.endsWith("_test") && !database.includes("test")) {
  throw new Error(`Refusing to prepare "${database}": the test database name must contain "test".`);
}

console.log(`Preparing test database ${database}.`);
const command = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(command, ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_TEST ?? testUrl,
    DATABASE_URL_UNPOOLED: testUrl,
  },
  shell: process.platform === "win32",
});
