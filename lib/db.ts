import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { gatefoldPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.gatefoldPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.gatefoldPrisma = prisma;
}

/** The interactive-transaction client excludes connection and transaction controls. */
export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
