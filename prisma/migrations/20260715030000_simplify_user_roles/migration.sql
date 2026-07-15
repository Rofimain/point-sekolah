CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE
      WHEN "role"::text = 'PIKET' THEN 'ADMIN'
      WHEN "role"::text = 'WALI_KELAS' THEN 'TEACHER'
      ELSE "role"::text
    END
  )::"Role_new";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
