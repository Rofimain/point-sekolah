-- Akun lama: anggap sudah punya password (jangan paksa ganti massal).
-- Siswa/user baru tetap passwordChangedAt = NULL → wajib ganti saat login credentials.
UPDATE "User"
SET "passwordChangedAt" = COALESCE("passwordChangedAt", "createdAt")
WHERE "passwordChangedAt" IS NULL;
