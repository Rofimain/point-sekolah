-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER', 'PIKET', 'WALI_KELAS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('RINGAN', 'SEDANG', 'BERAT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "nisn" TEXT,
    "nip" TEXT,
    "parentTelegram" TEXT,
    "parentTelegramLinkToken" TEXT,
    "classId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViolationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViolationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViolationRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "violationTypeId" TEXT NOT NULL,
    "session" TEXT,
    "notes" TEXT,
    "points" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByName" TEXT,
    "evidenceImageData" TEXT,
    "evidenceImagePresent" BOOLEAN NOT NULL DEFAULT false,
    "studentSignatureData" TEXT,
    "submittedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViolationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PointAdjustment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grossTotalBefore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nisn_key" ON "User"("nisn");

-- CreateIndex
CREATE UNIQUE INDEX "User_nip_key" ON "User"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "User_parentTelegramLinkToken_key" ON "User"("parentTelegramLinkToken");

-- CreateIndex
CREATE INDEX "ViolationRecord_submittedByStudent_createdAt_idx" ON "ViolationRecord"("submittedByStudent", "createdAt");

-- CreateIndex
CREATE INDEX "PointAdjustment_studentId_idx" ON "PointAdjustment"("studentId");

-- CreateIndex
CREATE INDEX "PointAdjustment_studentId_reason_idx" ON "PointAdjustment"("studentId", "reason");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViolationRecord" ADD CONSTRAINT "ViolationRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViolationRecord" ADD CONSTRAINT "ViolationRecord_violationTypeId_fkey" FOREIGN KEY ("violationTypeId") REFERENCES "ViolationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

