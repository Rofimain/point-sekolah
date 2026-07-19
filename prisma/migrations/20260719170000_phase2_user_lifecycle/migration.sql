-- Phase 2: user lifecycle status, Google prep fields, lifecycle audit (additive + backfill)

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'LEFT', 'SUSPENDED');
CREATE TYPE "AuthProvider" AS ENUM ('CREDENTIALS', 'GOOGLE', 'BOTH');
CREATE TYPE "UserCreatedFrom" AS ENUM ('MANUAL', 'ACADEMIC_IMPORT', 'GOOGLE_LINK');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "graduatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastAcademicYear" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdFrom" "UserCreatedFrom" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIALS';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Backfill dari flag legacy `active`
UPDATE "User" SET "status" = 'ACTIVE' WHERE "active" = true AND "status" = 'ACTIVE';
UPDATE "User" SET "status" = 'INACTIVE', "active" = false WHERE "active" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");
CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");

CREATE TABLE IF NOT EXISTS "UserLifecycleEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserLifecycleEvent_userId_createdAt_idx" ON "UserLifecycleEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserLifecycleEvent_event_createdAt_idx" ON "UserLifecycleEvent"("event", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserLifecycleEvent_userId_fkey'
  ) THEN
    ALTER TABLE "UserLifecycleEvent"
      ADD CONSTRAINT "UserLifecycleEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
