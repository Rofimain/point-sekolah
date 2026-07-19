-- Sembunyikan catatan pelanggaran siswa yang sudah soft-delete (orphan UI).
UPDATE "ViolationRecord" AS vr
SET "deletedAt" = COALESCE(u."deletedAt", NOW())
FROM "User" AS u
WHERE vr."studentId" = u.id
  AND u."deletedAt" IS NOT NULL
  AND vr."deletedAt" IS NULL;
