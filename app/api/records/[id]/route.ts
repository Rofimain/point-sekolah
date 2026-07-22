import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateHeavyViolationEvidence } from "@/lib/heavy-violation";
import { parseIncidentDateYmd } from "@/lib/incident-date";
import { canReadViolationRecord } from "@/lib/record-access";
import { normalizeEvidenceImagesFromBody } from "@/lib/evidence-data-url";
import { listRecordEvidenceImageData, replaceRecordEvidenceImages } from "@/lib/record-evidence-images";
import { softDeleteViolationRecord } from "@/lib/user-soft-delete";
import { recordDataAccessLog } from "@/lib/access-log";
import { isSameOriginRequest } from "@/lib/same-origin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }
  const { session } = auth;

  const existing = await prisma.violationRecord.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { points, notes, violationTypeId, studentSignatureData, date: dateInput } = body;

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

  const evidenceTouched = body.evidenceImages !== undefined || body.evidenceImageData !== undefined;
  let nextEvidenceImages: string[];
  if (evidenceTouched) {
    nextEvidenceImages = normalizeEvidenceImagesFromBody(body);
  } else {
    nextEvidenceImages = await listRecordEvidenceImageData(id);
  }

  const nextSig =
    studentSignatureData !== undefined
      ? typeof studentSignatureData === "string"
        ? studentSignatureData.trim() || null
        : existing.studentSignatureData
      : existing.studentSignatureData;

  const check = validateHeavyViolationEvidence(nextPoints, nextEvidenceImages, nextSig);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  let nextDate: Date | undefined;
  if (dateInput !== undefined && dateInput !== null && String(dateInput).trim() !== "") {
    const p = parseIncidentDateYmd(String(dateInput));
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    nextDate = p.date;
  }

  const updated = await prisma.violationRecord.update({
    where: { id },
    data: {
      violationTypeId: nextVtId,
      points: nextPoints,
      ...(notes !== undefined && { notes }),
      studentSignatureData: nextSig,
      ...(nextDate && { date: nextDate }),
      ...(evidenceTouched
        ? {
            evidenceImageData: nextEvidenceImages[0] ?? null,
            evidenceImagePresent: nextEvidenceImages.length > 0,
          }
        : {}),
    },
  });

  if (evidenceTouched) {
    await replaceRecordEvidenceImages(id, nextEvidenceImages);
  }

  const recordChanges: { field: string; label: string; from: string | null; to: string | null }[] = [];
  if (nextVtId !== existing.violationTypeId) {
    recordChanges.push({
      field: "violationTypeId",
      label: "Jenis pelanggaran",
      from: existing.violationTypeId,
      to: nextVtId,
    });
  }
  if (nextPoints !== existing.points) {
    recordChanges.push({
      field: "points",
      label: "Poin",
      from: String(existing.points),
      to: String(nextPoints),
    });
  }
  if (notes !== undefined && (notes || null) !== (existing.notes || null)) {
    recordChanges.push({
      field: "notes",
      label: "Keterangan",
      from: existing.notes || null,
      to: typeof notes === "string" ? notes || null : null,
    });
  }
  if (nextDate && nextDate.getTime() !== new Date(existing.date).getTime()) {
    recordChanges.push({
      field: "date",
      label: "Tanggal kejadian",
      from: existing.date.toISOString().slice(0, 10),
      to: nextDate.toISOString().slice(0, 10),
    });
  }
  if (evidenceTouched) {
    recordChanges.push({
      field: "evidenceImages",
      label: "Foto bukti",
      from: existing.evidenceImagePresent ? "ada" : "tidak ada",
      to: nextEvidenceImages.length > 0 ? `${nextEvidenceImages.length} foto` : "dihapus/kosong",
    });
  }
  if (studentSignatureData !== undefined) {
    const prev = Boolean(existing.studentSignatureData?.trim());
    const next = Boolean(nextSig?.trim());
    if (prev !== next || (typeof studentSignatureData === "string" && studentSignatureData.trim())) {
      recordChanges.push({
        field: "studentSignatureData",
        label: "Pengakuan/tanda tangan",
        from: prev ? "ada" : "tidak ada",
        to: next ? "ada/diubah" : "dihapus",
      });
    }
  }

  const changeSummary = recordChanges
    .map((c) => `${c.label}: ${c.from ?? "—"} → ${c.to ?? "—"}`)
    .join("; ");

  await recordDataAccessLog({
    session,
    action: "RECORD_UPDATE",
    summary: changeSummary
      ? `Mengubah catatan pelanggaran: ${changeSummary}`
      : `Mengubah catatan pelanggaran ${id}`,
    targetType: "ViolationRecord",
    targetId: id,
    meta: {
      points: nextPoints,
      violationTypeId: nextVtId,
      fields: recordChanges.map((c) => c.field),
      changes: recordChanges,
      evidenceTouched,
    },
  });

  return NextResponse.json(updated);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.violationRecord.findFirst({
    where: { id, deletedAt: null },
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

  const evidenceImages = await listRecordEvidenceImageData(id);
  const { studentId: _studentId, evidenceImageData: _legacy, ...safeRecord } = record;
  return NextResponse.json(
    {
      ...safeRecord,
      evidenceImages,
      evidenceImageData: evidenceImages[0] ?? null,
    },
    {
      headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
    }
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }
  const { session } = auth;
  const ok = await softDeleteViolationRecord(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await recordDataAccessLog({
    session,
    action: "RECORD_DELETE",
    summary: `Soft-delete catatan pelanggaran ${id}`,
    targetType: "ViolationRecord",
    targetId: id,
  });
  return NextResponse.json({ ok: true, softDeleted: true });
}
