-- Multi-foto bukti pelanggaran
CREATE TABLE "ViolationEvidenceImage" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViolationEvidenceImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ViolationEvidenceImage_recordId_sortOrder_idx" ON "ViolationEvidenceImage"("recordId", "sortOrder");

ALTER TABLE "ViolationEvidenceImage" ADD CONSTRAINT "ViolationEvidenceImage_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ViolationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrasi foto lama (kolom tunggal) ke tabel baru
INSERT INTO "ViolationEvidenceImage" ("id", "recordId", "sortOrder", "imageData", "createdAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  0,
  r."evidenceImageData",
  COALESCE(r."createdAt", CURRENT_TIMESTAMP)
FROM "ViolationRecord" r
WHERE r."evidenceImageData" IS NOT NULL AND TRIM(r."evidenceImageData") <> '';
