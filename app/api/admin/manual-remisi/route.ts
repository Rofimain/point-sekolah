import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { applyManualRemisiForStudent, getGrossPointsOnOrBefore } from "@/lib/manual-remisi";
import { resolveManualRemisiPercent } from "@/lib/remisi-rules";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { calendarTodayYmd } from "@/lib/incident-date";
import { recordDataAccessLog } from "@/lib/access-log";

/** Pratinjau: skor eligible sampai tanggal prestasi + potongan. */
export async function GET(req: NextRequest) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;

  const sp = req.nextUrl.searchParams;
  const studentId = (sp.get("studentId") || "").trim();
  const achievementYmd = (sp.get("achievementYmd") || "").trim();
  if (!studentId || !achievementYmd) {
    return NextResponse.json({ error: "studentId dan achievementYmd wajib" }, { status: 400 });
  }

  const scoped = await getGrossPointsOnOrBefore(studentId, achievementYmd);
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: 400 });

  const { effective, gross } = await getEffectivePointsBreakdown(studentId);

  let percent: number | null = null;
  let pointsDelta: number | null = null;
  const customPercent = sp.get("customPercent");
  if (customPercent != null && customPercent !== "") {
    const resolved = resolveManualRemisiPercent(Number(customPercent));
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
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const achievementYmd = typeof body.achievementYmd === "string" ? body.achievementYmd.trim() : "";
  const customLabel = typeof body.customLabel === "string" ? body.customLabel.trim() : "";
  const customPercent =
    body.customPercent != null && body.customPercent !== "" ? Number(body.customPercent) : NaN;
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!studentId) return NextResponse.json({ error: "Siswa wajib dipilih" }, { status: 400 });
  if (!achievementYmd) {
    return NextResponse.json({ error: "Tanggal prestasi wajib diisi" }, { status: 400 });
  }
  if (achievementYmd > calendarTodayYmd()) {
    return NextResponse.json({ error: "Tanggal prestasi tidak boleh di masa depan" }, { status: 400 });
  }
  if (customLabel.length < 2) {
    return NextResponse.json({ error: "Nama jenis remisi/reward wajib diisi" }, { status: 400 });
  }
  if (!Number.isFinite(customPercent)) {
    return NextResponse.json({ error: "Persentase pengurangan wajib diisi" }, { status: 400 });
  }

  const applied = await applyManualRemisiForStudent({
    studentId,
    achievementYmd,
    customPercent,
    customLabel,
    note,
  });

  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 400 });
  }

  await recordDataAccessLog({
    session,
    action: "REMISI_MANUAL",
    summary: `Remisi manual "${customLabel}" (${applied.result.percent}%) untuk siswa ${studentId}`,
    targetType: "User",
    targetId: studentId,
    meta: {
      customLabel,
      achievementYmd,
      percent: applied.result.percent,
      pointsDelta: applied.result.pointsDelta,
    },
  });

  return NextResponse.json({ ok: true, ...applied.result });
}
