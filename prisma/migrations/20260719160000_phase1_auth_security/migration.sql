-- Phase 1 auth security: lockout fields + login audit (additive, backward compatible)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AuthLoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "identifier" TEXT,
    "provider" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuthLoginEvent_createdAt_idx" ON "AuthLoginEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AuthLoginEvent_userId_createdAt_idx" ON "AuthLoginEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuthLoginEvent_ip_createdAt_idx" ON "AuthLoginEvent"("ip", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuthLoginEvent_userId_fkey'
  ) THEN
    ALTER TABLE "AuthLoginEvent"
      ADD CONSTRAINT "AuthLoginEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
