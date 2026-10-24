import path from "node:path";
import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile();
} catch {
  // CI and Vercel provide the environment directly.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx scripts/seed-demo.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
