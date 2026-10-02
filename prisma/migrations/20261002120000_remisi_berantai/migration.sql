ALTER TABLE "PointAdjustment" ADD COLUMN "effectiveDate" TIMESTAMP(3);
ALTER TABLE "PointAdjustment" ADD COLUMN "effectiveBefore" INTEGER;
ALTER TABLE "PointAdjustment" ADD COLUMN "reversalOfId" TEXT;
ALTER TABLE "PointAdjustment" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "PointAdjustment" ADD COLUMN "isBackfill" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "PointAdjustment_reversalOfId_key" ON "PointAdjustment"("reversalOfId");
CREATE INDEX "PointAdjustment_studentId_effectiveDate_idx" ON "PointAdjustment"("studentId", "effectiveDate");
