import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Pass datasource URL explicitly to avoid PrismaClientConstructorValidationError
// when DATABASE_URL is undefined or empty.
const dbUrl = process.env.DATABASE_URL?.trim();

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: dbUrl,
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : ["error"],
  });
}

// Only cache on globalThis in production. In dev, caching a PrismaClient across hot reloads
// leaves a stale instance without delegates added after `prisma generate` (e.g. new models).
const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : createPrismaClient();

export { prisma };
