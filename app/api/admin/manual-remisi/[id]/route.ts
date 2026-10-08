import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { deleteManualRemisiById, getManualRemisiForEdit, updateManualRemisiById } from "@/lib/manual-remisi";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { recordDataAccessLog } from "@/lib/access-log";
import { reconcileAutoRemisiForStudent } from "@/lib/quiet-month-reduction";
import { isSameOriginRequest } from "@/lib/same-origin";

/** Data satu remisi manual untuk form ubah. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;

  const found = await getManualRemisiForEdit(id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  return NextResponse.json(found.row);
}

/** Ubah remisi manual, lalu hitung ulang remisi otomatis yang jatuh tempo sesudahnya. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }
  const { session } = auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const customLabel = typeof body.customLabel === "string" ? body.customLabel : "";
  const achievementYmd = typeof body.achievementYmd === "string" ? body.achievementYmd : "";
  const customPercent =
    body.customPercent != null && body.customPercent !== "" ? Number(body.customPercent) : NaN;
  const note = typeof body.note === "string" ? body.note : undefined;

  const updated = await updateManualRemisiById({
    id,
    customLabel,
    customPercent,
    achievementYmd,
    note,
  });
  if (!updated.ok) return NextResponse.json({ error: updated.error }, { status: updated.status });

  let autoCreated = 0;
  let autoReversed = 0;
  let autoRebuilt = 0;
  try {
    const reconciled = await reconcileAutoRemisiForStudent(updated.result.studentId, {
      actorName: session.user.name ?? undefined,
      rebuildAutoAfterYmd: updated.result.effectiveYmd,
    });
    autoCreated = reconciled.created;
    autoReversed = reconciled.reversed;
    autoRebuilt = reconciled.rebuilt;
  } catch (e) {
    console.error("[manual-remisi PATCH] remisi otomatis gagal:", e);
  }

  const { result } = updated;
  const final = await getEffectivePointsBreakdown(result.studentId);
  await recordDataAccessLog({
    session,
    action: "REMISI_MANUAL_UBAH",
    summary: `Ubah remisi manual "${result.label}" (${result.percent}%, ${result.pointsDelta} poin) untuk ${result.studentName}. Poin efektif sekarang ${final.effective}.`,
    targetType: "PointAdjustment",
    targetId: result.id,
    meta: {
      studentId: result.studentId,
      label: result.label,
      percent: result.percent,
      basis: result.basis,
      pointsDelta: result.pointsDelta,
      effectiveYmd: result.effectiveYmd,
      effectiveAfter: final.effective,
      autoCreated,
      autoReversed,
      autoRebuilt,
    },
  });

  return NextResponse.json({
    ok: true,
    ...result,
    effectiveAfter: final.effective,
    autoCreated,
    autoReversed,
    autoRebuilt,
  });
}

/** Hapus satu remisi manual. Baris remisi otomatis ditolak. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }
  const { session } = auth;

  const deleted = await deleteManualRemisiById(id);
  if (!deleted.ok) {
    return NextResponse.json({ error: deleted.error }, { status: deleted.status });
  }

  let autoCreated = 0;
  let autoReversed = 0;
  let autoRebuilt = 0;
  try {
    const reconciled = await reconcileAutoRemisiForStudent(deleted.result.studentId, {
      actorName: session.user.name ?? undefined,
      rebuildAutoAfterYmd: deleted.result.effectiveYmd,
    });
    autoCreated = reconciled.created;
    autoReversed = reconciled.reversed;
    autoRebuilt = reconciled.rebuilt;
  } catch (e) {
    console.error("[manual-remisi DELETE] remisi otomatis gagal:", e);
  }

  const { result } = deleted;
  const final = await getEffectivePointsBreakdown(result.studentId);
  await recordDataAccessLog({
    session,
    action: "REMISI_MANUAL_HAPUS",
    summary: `Hapus remisi manual "${result.label}" (${result.pointsDelta} poin) untuk ${result.studentName}. Poin efektif ${result.effectiveBefore} → ${final.effective}.`,
    targetType: "PointAdjustment",
    targetId: result.id,
    meta: {
      studentId: result.studentId,
      label: result.label,
      pointsDelta: result.pointsDelta,
      pointsRestored: result.pointsRestored,
      effectiveBefore: result.effectiveBefore,
      effectiveAfter: final.effective,
      autoCreated,
      autoReversed,
      autoRebuilt,
    },
  });

  return NextResponse.json({
    ok: true,
    ...result,
    effectiveAfter: final.effective,
    autoCreated,
    autoReversed,
    autoRebuilt,
  });
}
