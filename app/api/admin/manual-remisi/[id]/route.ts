import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { deleteManualRemisiById } from "@/lib/manual-remisi";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { recordDataAccessLog } from "@/lib/access-log";
import { reconcileAutoRemisiForStudent } from "@/lib/quiet-month-reduction";
import { isSameOriginRequest } from "@/lib/same-origin";

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
