-- CreateEnum
CREATE TYPE "AccessLogPortal" AS ENUM ('STUDENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AccessLogCategory" AS ENUM ('LOGIN', 'DATA');

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portal" "AccessLogPortal" NOT NULL,
    "category" "AccessLogCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "meta" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_category_createdAt_idx" ON "AccessLog"("category", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_actorId_createdAt_idx" ON "AccessLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_action_createdAt_idx" ON "AccessLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_portal_createdAt_idx" ON "AccessLog"("portal", "createdAt");
