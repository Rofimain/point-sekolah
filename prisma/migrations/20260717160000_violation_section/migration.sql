-- AlterTable
ALTER TABLE "ViolationType" ADD COLUMN "section" TEXT;
ALTER TABLE "ViolationType" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ViolationType_section_sortOrder_idx" ON "ViolationType"("section", "sortOrder");
