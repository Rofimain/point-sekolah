import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Satu instance per isolat (dev HMR + warm Vercel) mengurangi cold connection ke Neon. */
export const prisma = globalForPrisma.prisma ?? makeClient();
globalForPrisma.prisma = prisma;
