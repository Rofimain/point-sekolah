import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateViolationRecord, formatStaffDisplayName, isStaffRole } from "@/lib/staff-roles";
import { validateHeavyViolationEvidence } from "@/lib/heavy-violation";
import { sendParentViolationTelegram } from "@/lib/telegram-notify";
import { parseOptionalIncidentDate } from "@/lib/incident-date";
import { normalizeEvidenceImagesFromBody } from "@/lib/evidence-data-url";
import { replaceRecordEvidenceImages } from "@/lib/record-evidence-images";
import { recordDataAccessLog } from "@/lib/access-log";
import { parseRecordsListPagination } from "@/lib/records-pagination";
import { visibleViolationRecordWhere } from "@/lib/record-visibility";
import { isSameOriginRequest } from "@/lib/same-origin";
import { canUserLogin } from "@/lib/user-status";
import { AUTH_SESSION_REPLACED_ERROR } from "@/lib/auth-constants";

const MAX_NOTES_CHARS = 2_000;
const MAX_SESSION_CHARS = 80;

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

function truncateField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function sessionAuthError(session: Session | null): NextResponse | null {
  if (!session) {
    return NextResponse.json(
      { error: "Sesi berakhir. Silakan login ulang, lalu kirim lagi.", code: "SESSION_EXPIRED" },
      { status: 401 }
    );
  }
  if (session.error === "SessionRevoked") {
    return NextResponse.json(
      { error: AUTH_SESSION_REPLACED_ERROR, code: "SESSION_REPLACED" },
      { status: 401 }
    );
  }
  if (session.error || !session.user?.id) {
    return NextResponse.json(
      { error: "Sesi tidak valid. Silakan login ulang.", code: "SESSION_INVALID" },
      { status: 401 }
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const authErr = sessionAuthError(session);
  if (authErr) return authErr;

  const actor = session!.user;
  if (!canCreateViolationRecord(actor.role)) {
    return NextResponse.json({ error: "Anda tidak berhak mengirim catatan.", code: "FORBIDDEN" }, { status: 403 });
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Permintaan tidak valid.", code: "CSRF" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const violationTypeId = typeof body.violationTypeId === "string" ? body.violationTypeId.trim() : "";
  const sessionSlot = truncateField(body.session, MAX_SESSION_CHARS);
  const notes = truncateField(body.notes, MAX_NOTES_CHARS);
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const studentSignatureData = body.studentSignatureData;
  const dateInput = body.date;
  const evidenceImages = normalizeEvidenceImagesFromBody(body);

  let targetStudentId = actor.id;
  if (actor.role === "STUDENT") {
    /** Siswa hanya boleh melapor untuk diri sendiri — abaikan/tolak spoof studentId. */
    if (studentId && studentId !== actor.id && studentId !== actor.nisn) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const self = await prisma.user.findFirst({
      where: { id: actor.id, role: "STUDENT", deletedAt: null },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!self || !canUserLogin(self.status, self.deletedAt)) {
      return NextResponse.json({ error: "Akun tidak aktif." }, { status: 403 });
    }
    targetStudentId = self.id;
  } else {
    if (!isStaffRole(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!studentId) return NextResponse.json({ error: "studentId diperlukan" }, { status: 400 });
    const student = await prisma.user.findFirst({
      where: { OR: [{ id: studentId }, { nisn: studentId }], role: "STUDENT", deletedAt: null },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!student) return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    if (!canUserLogin(student.status, student.deletedAt)) {
      return NextResponse.json({ error: "Akun siswa tidak aktif." }, { status: 400 });
    }
    targetStudentId = student.id;
  }

  if (!violationTypeId) return NextResponse.json({ error: "violationTypeId diperlukan" }, { status: 400 });

  const vt = await prisma.violationType.findFirst({
    where: { id: violationTypeId, active: true },
  });
  if (!vt) return NextResponse.json({ error: "Jenis pelanggaran tidak ditemukan atau nonaktif" }, { status: 404 });

  const resolvedPoints = vt.points;
  const signature = typeof studentSignatureData === "string" ? studentSignatureData : null;

  const check = validateHeavyViolationEvidence(resolvedPoints, evidenceImages, signature);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const incident = parseOptionalIncidentDate(dateInput);
  if (!incident.ok) return NextResponse.json({ error: incident.error }, { status: 400 });

  let createdByName: string | undefined;
  if (actor.role === "STUDENT") {
    createdByName = actor.name ?? undefined;
  } else {
    const staff = await prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
      select: { name: true, jabatan: true },
    });
    createdByName = formatStaffDisplayName({
      name: staff?.name ?? actor.name,
      jabatan: staff?.jabatan,
    });
  }

  let record;
  try {
    record = await prisma.violationRecord.create({
      data: {
        studentId: targetStudentId,
        violationTypeId,
        session: sessionSlot,
        notes,
        points: resolvedPoints,
        date: incident.date,
        submittedByStudent: actor.role === "STUDENT",
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

  const staffName = actor.role === "STUDENT" ? null : (createdByName ?? null);
  const payload = {
    studentName: record.student.name,
    violationName: record.violationType.name,
    points: resolvedPoints,
    sessionSlot,
    notes,
    recordedByStaffName: staffName,
  };

  /**
   * Jangan biarkan notifikasi Telegram menahan response simpan.
   * Kirim di background setelah catatan sukses tersimpan (runtime Docker/Node tetap hidup).
   */
  let parentTelegramNotify:
    | { status: "sent" }
    | { status: "skipped_no_recipient" }
    | { status: "skipped_no_token" }
    | { status: "queued" }
    | { status: "failed"; message: string };

  const chat = record.student.parentTelegram?.trim();
  if (!chat) {
    parentTelegramNotify = { status: "skipped_no_recipient" };
  } else if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN kosong — notifikasi ortu tidak dikirim");
    parentTelegramNotify = { status: "skipped_no_token" };
  } else {
    parentTelegramNotify = { status: "queued" };
    const notifyPayload = payload;
    void sendParentViolationTelegram(chat, notifyPayload)
      .then((r) => {
        if (!r.ok) console.error("[telegram] kirim ke ortu gagal:", r.error);
      })
      .catch((e) => {
        console.error("[telegram] exception setelah simpan catatan:", e);
      });
  }

  await recordDataAccessLog({
    session: session!,
    action: "RECORD_CREATE",
    summary: `Catat pelanggaran: ${record.violationType.name} (${resolvedPoints} poin) — ${record.student.name}`,
    targetType: "ViolationRecord",
    targetId: record.id,
    meta: {
      studentId: targetStudentId,
      violationTypeId,
      points: resolvedPoints,
      submittedByStudent: actor.role === "STUDENT",
    },
    portal: actor.role === "STUDENT" ? "STUDENT" : "STAFF",
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
  const authErr = sessionAuthError(session);
  if (authErr) return authErr;

  if (session!.user.role === "STUDENT") {
    const records = await prisma.violationRecord.findMany({
      where: { studentId: session!.user.id, deletedAt: null },
      select: studentRecordSelect,
      orderBy: { date: "desc" },
      take: 500,
    });
    return NextResponse.json(records);
  }
  if (!isStaffRole(session!.user.role)) {
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
