import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Satu instance Prisma per proses (dev HMR + container) agar koneksi ke Postgres tidak dilipat-gandakan. */
export const prisma = globalForPrisma.prisma ?? makeClient();
globalForPrisma.prisma = prisma;
