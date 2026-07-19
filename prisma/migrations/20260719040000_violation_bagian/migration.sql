-- Master bagian jenis pelanggaran (bisa ditambah admin)
CREATE TABLE "ViolationBagian" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViolationBagian_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ViolationBagian_sortOrder_label_idx" ON "ViolationBagian"("sortOrder", "label");

INSERT INTO "ViolationBagian" ("id", "label", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('KELAKUAN', 'Kelakuan', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KERAJINAN', 'Kerajinan', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('KERAPIHAN', 'Kerapihan', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Ambil bagian yang sudah ada di ViolationType tapi belum di master
INSERT INTO "ViolationBagian" ("id", "label", "sortOrder", "active", "createdAt", "updatedAt")
SELECT DISTINCT
  vt."section",
  vt."section",
  100,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ViolationType" vt
WHERE vt."section" IS NOT NULL
  AND vt."section" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "ViolationBagian" vb WHERE vb."id" = vt."section"
  );
