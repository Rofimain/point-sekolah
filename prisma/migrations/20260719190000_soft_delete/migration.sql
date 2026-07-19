-- Soft-delete untuk User dan ViolationRecord (pre-launch hardening)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ViolationRecord" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "ViolationRecord_deletedAt_idx" ON "ViolationRecord"("deletedAt");
