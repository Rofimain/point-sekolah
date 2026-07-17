-- AlterTable
ALTER TABLE "User" ADD COLUMN "photoData" TEXT,
ADD COLUMN "photoPresent" BOOLEAN NOT NULL DEFAULT false;
