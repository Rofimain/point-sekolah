import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { validateHeavyViolationEvidence } from "@/lib/heavy-violation";
import { parseIncidentDateYmd } from "@/lib/incident-date";
import { canReadViolationRecord } from "@/lib/record-access";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.violationRecord.findUnique({
    where: { id: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { points, notes, violationTypeId, evidenceImageData, studentSignatureData, date: dateInput } = body;

  const nextVtId = typeof violationTypeId === "string" && violationTypeId ? violationTypeId : existing.violationTypeId;
  const vt = await prisma.violationType.findUnique({ where: { id: nextVtId } });
  if (!vt) return NextResponse.json({ error: "Jenis pelanggaran tidak ditemukan" }, { status: 404 });

  let nextPoints = existing.points;
  if (points !== undefined && points !== null && String(points).trim() !== "") {
    const n = Number(points);
    if (Number.isFinite(n)) nextPoints = n;
  } else if (nextVtId !== existing.violationTypeId) {
    nextPoints = vt.points;
  }

  const nextEvidence =
    evidenceImageData !== undefined
      ? typeof evidenceImageData === "string"
        ? evidenceImageData.trim() || null
        : existing.evidenceImageData
      : existing.evidenceImageData;
  const nextSig =
    studentSignatureData !== undefined
      ? typeof studentSignatureData === "string"
        ? studentSignatureData.trim() || null
        : existing.studentSignatureData
      : existing.studentSignatureData;

  const check = validateHeavyViolationEvidence(nextPoints, nextEvidence, nextSig);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  let nextDate: Date | undefined;
  if (dateInput !== undefined && dateInput !== null && String(dateInput).trim() !== "") {
    const p = parseIncidentDateYmd(String(dateInput));
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    nextDate = p.date;
  }

  const updated = await prisma.violationRecord.update({
    where: { id: params.id },
    data: {
      violationTypeId: nextVtId,
      points: nextPoints,
      ...(notes !== undefined && { notes }),
      evidenceImageData: nextEvidence,
      evidenceImagePresent: Boolean(nextEvidence?.trim()),
      studentSignatureData: nextSig,
      ...(nextDate && { date: nextDate }),
    },
  });
  return NextResponse.json(updated);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.violationRecord.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      studentId: true,
      evidenceImageData: true,
      studentSignatureData: true,
      points: true,
      session: true,
      notes: true,
      date: true,
      createdAt: true,
      createdByName: true,
      student: { select: { name: true, nisn: true, class: { select: { name: true } } } },
      violationType: { select: { name: true } },
    },
  });

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canReadViolationRecord(session.user, record.studentId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { studentId: _studentId, ...safeRecord } = record;
  return NextResponse.json(safeRecord, {
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.violationRecord.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
