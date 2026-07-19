import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { validateHeavyViolationEvidence } from "@/lib/heavy-violation";
import { sendParentViolationTelegram } from "@/lib/telegram-notify";
import { parseOptionalIncidentDate } from "@/lib/incident-date";
import { normalizeEvidenceImagesFromBody } from "@/lib/evidence-data-url";
import { replaceRecordEvidenceImages } from "@/lib/record-evidence-images";
import { formatStaffDisplayName } from "@/lib/staff-roles";
import { recordDataAccessLog } from "@/lib/access-log";
import { parseRecordsListPagination } from "@/lib/records-pagination";
import { visibleViolationRecordWhere } from "@/lib/record-visibility";

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
  const { violationTypeId, session: sessionSlot, notes, studentId, studentSignatureData, date: dateInput } = body;
  const evidenceImages = normalizeEvidenceImagesFromBody(body);

  let targetStudentId = session.user.id;
  if (session.user.role !== "STUDENT") {
    if (!isStaffRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!studentId) return NextResponse.json({ error: "studentId diperlukan" }, { status: 400 });
    const student = await prisma.user.findFirst({
      where: { OR: [{ id: studentId }, { nisn: studentId }], role: "STUDENT", deletedAt: null },
    });
    if (!student) return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    targetStudentId = student.id;
  }

  if (!violationTypeId) return NextResponse.json({ error: "violationTypeId diperlukan" }, { status: 400 });

  const vt = await prisma.violationType.findUnique({ where: { id: violationTypeId } });
  if (!vt) return NextResponse.json({ error: "Jenis pelanggaran tidak ditemukan" }, { status: 404 });

  const resolvedPoints = vt.points;
  const signature = typeof studentSignatureData === "string" ? studentSignatureData : null;

  const check = validateHeavyViolationEvidence(resolvedPoints, evidenceImages, signature);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const incident = parseOptionalIncidentDate(dateInput);
  if (!incident.ok) return NextResponse.json({ error: incident.error }, { status: 400 });

  let createdByName: string | undefined;
  if (session.user.role === "STUDENT") {
    createdByName = session.user.name ?? undefined;
  } else {
    const staff = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { name: true, jabatan: true },
    });
    createdByName = formatStaffDisplayName({
      name: staff?.name ?? session.user.name,
      jabatan: staff?.jabatan,
    });
  }

  let record;
  try {
    record = await prisma.violationRecord.create({
      data: {
        studentId: targetStudentId,
        violationTypeId,
        session: sessionSlot || null,
        notes: notes || null,
        points: resolvedPoints,
        date: incident.date,
        submittedByStudent: session.user.role === "STUDENT",
        createdByName,
        evidenceImageData: evidenceImages[0] ?? null,
        evidenceImagePresent: evidenceImages.length > 0,
        studentSignatureData: signature && signature.trim() ? signature.trim() : null,
      },
      include: {
        student: { select: { id: true, name: true, parentTelegram: true } },
        violationType: true,
      },
    });

    if (evidenceImages.length > 0) {
      await replaceRecordEvidenceImages(record.id, evidenceImages);
    }
  } catch (e) {
    console.error("[records POST] gagal menyimpan catatan pelanggaran:", e);
    return NextResponse.json({ error: "Gagal menyimpan catatan. Coba lagi." }, { status: 500 });
  }

  const staffName = session.user.role === "STUDENT" ? null : (createdByName ?? null);
  const payload = {
    studentName: record.student.name,
    violationName: record.violationType.name,
    points: resolvedPoints,
    sessionSlot: sessionSlot || null,
    notes: notes || null,
    recordedByStaffName: staffName,
  };

  /** Wajib await: jangan fire-and-forget — request bisa berakhir sebelum fetch ke Telegram selesai. */
  let parentTelegramNotify:
    | { status: "sent" }
    | { status: "skipped_no_recipient" }
    | { status: "skipped_no_token" }
    | { status: "failed"; message: string };

  const chat = record.student.parentTelegram?.trim();
  if (!chat) {
    parentTelegramNotify = { status: "skipped_no_recipient" };
  } else if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN kosong — notifikasi ortu tidak dikirim");
    parentTelegramNotify = { status: "skipped_no_token" };
  } else {
    const r = await sendParentViolationTelegram(chat, payload);
    parentTelegramNotify = r.ok
      ? { status: "sent" }
      : { status: "failed", message: "Gagal mengirim notifikasi Telegram ke ortu." };
    if (!r.ok) console.error("[telegram] kirim ke ortu gagal:", r.error);
  }

  await recordDataAccessLog({
    session,
    action: "RECORD_CREATE",
    summary: `Catat pelanggaran: ${record.violationType.name} (${resolvedPoints} poin) — ${record.student.name}`,
    targetType: "ViolationRecord",
    targetId: record.id,
    meta: {
      studentId: targetStudentId,
      violationTypeId,
      points: resolvedPoints,
      submittedByStudent: session.user.role === "STUDENT",
    },
    portal: session.user.role === "STUDENT" ? "STUDENT" : "STAFF",
  });

  return NextResponse.json(
    {
      id: record.id,
      date: record.date,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      parentTelegramNotify,
    },
    { status: 201 }
  );
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "STUDENT") {
    const records = await prisma.violationRecord.findMany({
      where: { studentId: session.user.id, deletedAt: null },
      select: studentRecordSelect,
      orderBy: { date: "desc" },
      take: 500,
    });
    return NextResponse.json(records);
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const { page, perPage, skip } = parseRecordsListPagination(sp);

  const where = visibleViolationRecordWhere();
  const [records, total] = await Promise.all([
    prisma.violationRecord.findMany({
      where,
      include: { student: { include: { class: true } }, violationType: true },
      orderBy: { date: "desc" },
      skip,
      take: perPage,
    }),
    prisma.violationRecord.count({ where }),
  ]);
  return NextResponse.json({
    data: records,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  });
}
