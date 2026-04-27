import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { validateHeavyViolationEvidence } from "@/lib/heavy-violation";

const studentRecordSelect = {
  id: true,
  studentId: true,
  violationTypeId: true,
  session: true,
  notes: true,
  points: true,
  date: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
  violationType: true,
} as const;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { violationTypeId, session: sessionSlot, notes, studentId, points, evidenceImageData, studentSignatureData } = body;

  let targetStudentId = session.user.id;
  if (session.user.role !== "STUDENT") {
    if (!isStaffRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!studentId) return NextResponse.json({ error: "studentId diperlukan" }, { status: 400 });
    const student = await prisma.user.findFirst({
      where: { OR: [{ id: studentId }, { nisn: studentId }], role: "STUDENT" },
    });
    if (!student) return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    targetStudentId = student.id;
  }

  if (!violationTypeId) return NextResponse.json({ error: "violationTypeId diperlukan" }, { status: 400 });

  const vt = await prisma.violationType.findUnique({ where: { id: violationTypeId } });
  if (!vt) return NextResponse.json({ error: "Jenis pelanggaran tidak ditemukan" }, { status: 404 });

  const resolvedPoints = typeof points === "number" && Number.isFinite(points) ? points : vt.points;
  const evidence = typeof evidenceImageData === "string" ? evidenceImageData : null;
  const signature = typeof studentSignatureData === "string" ? studentSignatureData : null;

  const check = validateHeavyViolationEvidence(resolvedPoints, evidence, signature);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const record = await prisma.violationRecord.create({
    data: {
      studentId: targetStudentId,
      violationTypeId,
      session: sessionSlot || null,
      notes: notes || null,
      points: resolvedPoints,
      createdByName: session.user.name ?? undefined,
      evidenceImageData: evidence && evidence.trim() ? evidence.trim() : null,
      studentSignatureData: signature && signature.trim() ? signature.trim() : null,
    },
    include: { student: true, violationType: true },
  });

  return NextResponse.json(record, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "STUDENT") {
    const records = await prisma.violationRecord.findMany({
      where: { studentId: session.user.id },
      select: studentRecordSelect,
      orderBy: { date: "desc" },
      take: 500,
    });
    return NextResponse.json(records);
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const records = await prisma.violationRecord.findMany({
    include: { student: { include: { class: true } }, violationType: true },
    orderBy: { date: "desc" },
    take: 3000,
  });
  return NextResponse.json(records);
}
