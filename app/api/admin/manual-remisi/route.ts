import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { applyManualRemisiForStudent, getGrossPointsOnOrBefore } from "@/lib/manual-remisi";
import {
  MANUAL_REMISI_TYPE,
  getManualRemisiDef,
  resolveManualRemisiPercent,
  type ManualRemisiType,
} from "@/lib/remisi-rules";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { calendarTodayYmd } from "@/lib/incident-date";
import { recordDataAccessLog } from "@/lib/access-log";

const VALID_TYPES = new Set<string>(Object.values(MANUAL_REMISI_TYPE));

/** Pratinjau: skor eligible sampai tanggal prestasi + potongan. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const studentId = (sp.get("studentId") || "").trim();
  const achievementYmd = (sp.get("achievementYmd") || "").trim();
  const type = (sp.get("type") || "").trim();
  if (!studentId || !achievementYmd) {
    return NextResponse.json({ error: "studentId dan achievementYmd wajib" }, { status: 400 });
  }

  const scoped = await getGrossPointsOnOrBefore(studentId, achievementYmd);
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: 400 });

  const { effective, gross } = await getEffectivePointsBreakdown(studentId);

  let percent: number | null = null;
  let pointsDelta: number | null = null;
  if (type && VALID_TYPES.has(type)) {
    const customPercent = sp.get("customPercent");
    const multiplier = sp.get("multiplier");
    const resolved = resolveManualRemisiPercent(type as ManualRemisiType, {
      customPercent: customPercent != null && customPercent !== "" ? Number(customPercent) : undefined,
      multiplier: multiplier != null && multiplier !== "" ? Number(multiplier) : undefined,
    });
    if (resolved.ok) {
      percent = resolved.percent;
      const deduct = Math.round(scoped.eligibleGross * (resolved.percent / 100));
      pointsDelta = -Math.min(Math.max(0, deduct), effective);
    }
  }

  return NextResponse.json({
    studentId,
    achievementYmd,
    eligibleGross: scoped.eligibleGross,
    grossTotal: gross,
    effective,
    percent,
    pointsDelta,
    effectiveAfter: pointsDelta != null ? Math.max(0, effective + pointsDelta) : effective,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const achievementYmd =
    typeof body.achievementYmd === "string" ? body.achievementYmd.trim() : "";

  if (!studentId) return NextResponse.json({ error: "Siswa wajib dipilih" }, { status: 400 });
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Jenis remisi/reward tidak valid" }, { status: 400 });
  }
  if (!achievementYmd) {
    return NextResponse.json({ error: "Tanggal prestasi wajib diisi" }, { status: 400 });
  }
  if (achievementYmd > calendarTodayYmd()) {
    return NextResponse.json({ error: "Tanggal prestasi tidak boleh di masa depan" }, { status: 400 });
  }

  const def = getManualRemisiDef(type);
  const customPercent =
    body.customPercent != null && body.customPercent !== ""
      ? Number(body.customPercent)
      : undefined;
  const multiplier =
    body.multiplier != null && body.multiplier !== "" ? Number(body.multiplier) : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;
  const customLabel = typeof body.customLabel === "string" ? body.customLabel : undefined;

  if (def?.fixedPercent == null && (customPercent == null || !Number.isFinite(customPercent))) {
    return NextResponse.json({ error: "Persentase pengurangan wajib diisi" }, { status: 400 });
  }

  const applied = await applyManualRemisiForStudent({
    studentId,
    type: type as ManualRemisiType,
    achievementYmd,
    customPercent,
    multiplier,
    customLabel,
    note,
  });

  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 400 });
  }

  await recordDataAccessLog({
    session,
    action: "REMISI_MANUAL",
    summary: `Remisi manual ${type} untuk siswa ${studentId}`,
    targetType: "User",
    targetId: studentId,
    meta: { type, achievementYmd, pointsDelta: applied.result.pointsDelta },
  });

  return NextResponse.json({ ok: true, ...applied.result });
}
