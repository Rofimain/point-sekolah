import { prisma } from "@/lib/prisma";
import { calendarTodayYmd, dateInTimeZoneYmd } from "@/lib/incident-date";
import { parseManualRemisiReason } from "@/lib/remisi-rules";
import {
  formatYmdIndonesia,
  isQuietMonthReason,
  isQuietMonthReversalReason,
  parseQuietMonthReason,
  parseQuietMonthReversalReason,
} from "@/lib/point-adjustment-reason";

export type AutoHistoryRow = {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  step: number | null;
  anchorYmd: string | null;
  bersihSejak: string | null;
  effectiveYmd: string;
  effectiveBefore: number | null;
  pointsDelta: number;
  effectiveAfter: number | null;
  status: "berlaku" | "susulan" | "dibatalkan";
  sebab: string | null;
  createdAt: string;
  legacy: boolean;
};

export type ManualHistoryRow = {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  inputYmd: string;
  prestasiYmd: string | null;
  label: string;
  percent: number | null;
  basis: number;
  effectiveBefore: number | null;
  pointsDelta: number;
  effectiveAfter: number | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type RemisiHistoryQuery = {
  type: "auto" | "manual";
  from?: string;
  to?: string;
  classId?: string;
  status?: string;
  q?: string;
  jenis?: string;
};

function monthDefaults(): { from: string; to: string } {
  const today = calendarTodayYmd();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function inRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export async function queryRemisiHistory(query: RemisiHistoryQuery): Promise<{
  from: string;
  to: string;
  autoRows: AutoHistoryRow[];
  manualRows: ManualHistoryRow[];
  jenisOptions: string[];
  summary: {
    siswa: number;
    totalPoin: number;
    dibatalkan: number;
    siswaNol: number;
    jumlah: number;
    jenisTerbanyak: string | null;
  };
}> {
  const defaults = monthDefaults();
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : defaults.from;
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : defaults.to;
  const q = query.q?.trim().toLowerCase() ?? "";
  const classId = query.classId?.trim() || "";

  const studentWhere = {
    deletedAt: null,
    ...(classId ? { classId } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const rows = await prisma.pointAdjustment.findMany({
    where: { student: studentWhere },
    include: { student: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const reversalByTarget = new Map<string, string | null>();
  for (const row of rows) {
    if (row.reversalOfId && isQuietMonthReversalReason(row.reason)) {
      reversalByTarget.set(row.reversalOfId, parseQuietMonthReversalReason(row.reason).sebab);
    }
  }

  const autoRows: AutoHistoryRow[] = [];
  const manualAll: ManualHistoryRow[] = [];

  for (const row of rows) {
    const studentName = row.student.name;
    const className = row.student.class?.name ?? null;
    const classIdRow = row.student.classId;
    if (query.type === "auto" && isQuietMonthReason(row.reason) && !row.reversalOfId) {
      const parsed = parseQuietMonthReason(row.reason);
      const effectiveYmd = row.effectiveDate ? dateInTimeZoneYmd(row.effectiveDate) : dateInTimeZoneYmd(row.createdAt);
      if (!inRange(effectiveYmd, from, to)) continue;
      const legacy = parsed.step == null;
      const reversed = reversalByTarget.has(row.id);
      const status: AutoHistoryRow["status"] = reversed ? "dibatalkan" : row.isBackfill ? "susulan" : "berlaku";
      if (query.status && query.status !== "semua" && query.status !== status) continue;
      const effectiveBefore = row.effectiveBefore;
      autoRows.push({
        id: row.id,
        studentId: row.studentId,
        studentName,
        classId: classIdRow,
        className,
        step: parsed.step,
        anchorYmd: parsed.anchor,
        bersihSejak: parsed.anchor ? formatYmdIndonesia(parsed.anchor) : null,
        effectiveYmd,
        effectiveBefore,
        pointsDelta: row.pointsDelta,
        effectiveAfter: effectiveBefore != null ? effectiveBefore + row.pointsDelta : null,
        status,
        sebab: reversed ? (reversalByTarget.get(row.id) ?? null) : null,
        createdAt: row.createdAt.toISOString(),
        legacy,
      });
    }

    if (query.type === "manual" && row.reason.startsWith("MANUAL_") && !row.reversalOfId) {
      const parsed = parseManualRemisiReason(row.reason);
      const inputYmd = dateInTimeZoneYmd(row.createdAt);
      if (!inRange(inputYmd, from, to)) continue;
      const label = parsed.customLabel?.trim() || "Remisi manual";
      const basis = row.grossTotalBefore;
      const percent = basis > 0 ? Math.round((Math.abs(row.pointsDelta) / basis) * 100) : null;
      const effectiveBefore = row.effectiveBefore;
      manualAll.push({
        id: row.id,
        studentId: row.studentId,
        studentName,
        classId: classIdRow,
        className,
        inputYmd,
        prestasiYmd: parsed.achievementYmd ?? null,
        label,
        percent,
        basis,
        effectiveBefore,
        pointsDelta: row.pointsDelta,
        effectiveAfter: effectiveBefore != null ? effectiveBefore + row.pointsDelta : null,
        note: parsed.note ?? null,
        createdByName: row.createdByName,
        createdAt: row.createdAt.toISOString(),
      });
    }
  }

  const jenisOptions = [...new Set(manualAll.map((r) => r.label))].sort((a, b) => a.localeCompare(b, "id"));
  const jenis = query.jenis?.trim() || "";
  const manualRows = jenis ? manualAll.filter((r) => r.label === jenis) : manualAll;

  if (query.type === "auto") {
    const siswa = new Set(autoRows.map((r) => r.studentId));
    const aktif = autoRows.filter((r) => r.status !== "dibatalkan");
    const siswaNol = new Set(
      aktif.filter((r) => r.effectiveAfter != null && r.effectiveAfter <= 0).map((r) => r.studentId)
    );
    return {
      from,
      to,
      autoRows,
      manualRows: [],
      jenisOptions: [],
      summary: {
        siswa: siswa.size,
        totalPoin: aktif.reduce((sum, r) => sum + Math.abs(Math.min(0, r.pointsDelta)), 0),
        dibatalkan: autoRows.filter((r) => r.status === "dibatalkan").length,
        siswaNol: siswaNol.size,
        jumlah: autoRows.length,
        jenisTerbanyak: null,
      },
    };
  }

  const counts = new Map<string, number>();
  for (const r of manualRows) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  let jenisTerbanyak: string | null = null;
  let best = 0;
  for (const [label, n] of counts) {
    if (n > best) {
      best = n;
      jenisTerbanyak = label;
    }
  }
  return {
    from,
    to,
    autoRows: [],
    manualRows,
    jenisOptions,
    summary: {
      siswa: new Set(manualRows.map((r) => r.studentId)).size,
      totalPoin: manualRows.reduce((sum, r) => sum + Math.abs(r.pointsDelta), 0),
      dibatalkan: 0,
      siswaNol: 0,
      jumlah: manualRows.length,
      jenisTerbanyak,
    },
  };
}
