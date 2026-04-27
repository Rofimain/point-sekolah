import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { validateHeavyViolationEvidence } from "@/lib/heavy-violation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isStaffRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.violationRecord.findUnique({
    where: { id: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { points, notes, violationTypeId, evidenceImageData, studentSignatureData } = body;

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

  const updated = await prisma.violationRecord.update({
    where: { id: params.id },
    data: {
      violationTypeId: nextVtId,
      points: nextPoints,
      ...(notes !== undefined && { notes }),
      evidenceImageData: nextEvidence,
      studentSignatureData: nextSig,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isStaffRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.violationRecord.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
