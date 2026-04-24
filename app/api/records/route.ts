import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { violationTypeId, session: sessionSlot, notes, studentId, points } = body;

  // Determine actual student ID
  let targetStudentId = session.user.id;
  if (session.user.role !== "STUDENT") {
    if (!studentId) return NextResponse.json({ error: "studentId diperlukan" }, { status: 400 });
    // Find by NISN or ID
    const student = await prisma.user.findFirst({ where: { OR: [{ id: studentId }, { nisn: studentId }], role: "STUDENT" } });
    if (!student) return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    targetStudentId = student.id;
  }

  if (!violationTypeId) return NextResponse.json({ error: "violationTypeId diperlukan" }, { status: 400 });

  const vt = await prisma.violationType.findUnique({ where: { id: violationTypeId } });
  if (!vt) return NextResponse.json({ error: "Jenis pelanggaran tidak ditemukan" }, { status: 404 });

  const record = await prisma.violationRecord.create({
    data: {
      studentId: targetStudentId,
      violationTypeId,
      session: sessionSlot || null,
      notes: notes || null,
      points: points ?? vt.points,
      createdByName: session.user.name ?? undefined,
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
      include: { violationType: true },
      orderBy: { date: "desc" },
      take: 500,
    });
    return NextResponse.json(records);
  }
  const records = await prisma.violationRecord.findMany({
    include: { student: { include: { class: true } }, violationType: true },
    orderBy: { date: "desc" },
    take: 3000,
  });
  return NextResponse.json(records);
}
