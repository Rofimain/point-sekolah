-- Kelas hanya dimiliki akun siswa. Bersihkan relasi lama pada guru/admin.
UPDATE "User"
SET "classId" = NULL
WHERE "role" <> 'STUDENT' AND "classId" IS NOT NULL;
