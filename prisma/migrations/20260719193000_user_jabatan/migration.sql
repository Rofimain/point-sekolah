-- Field jabatan opsional (label tampilan saja, bukan permission)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jabatan" TEXT;
