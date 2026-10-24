try {
  process.loadEnvFile();
} catch {
  // CI provides the environment directly.
}

const testUrl = process.env.DATABASE_URL_TEST;
const testUnpooled = process.env.DATABASE_URL_TEST_UNPOOLED ?? testUrl;
if (!testUrl || !testUnpooled) {
  throw new Error("Integration tests require DATABASE_URL_TEST and DATABASE_URL_TEST_UNPOOLED.");
}
const database = new URL(testUrl).pathname.replace(/^\//, "");
if (!database.includes("test")) {
  throw new Error(`Refusing to run tests against "${database}".`);
}
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_URL_UNPOOLED = testUnpooled;
process.env.NODE_ENV = "test";
