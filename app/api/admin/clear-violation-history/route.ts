import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/staff-roles";
import { prisma } from "@/lib/prisma";

const CONFIRM_PHRASE = "RESET_ALL_POINTS";

/**
 * Super Admin only: hapus semua ViolationRecord (+ bukti) dan PointAdjustment.
 * Body: { confirm: "RESET_ALL_POINTS" }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `Konfirmasi wajib: kirim { "confirm": "${CONFIRM_PHRASE}" }` },
      { status: 400 }
    );
  }

  const [beforeEvidence, beforeRecords, beforeAdjustments] = await Promise.all([
    prisma.violationEvidenceImage.count(),
    prisma.violationRecord.count(),
    prisma.pointAdjustment.count(),
  ]);

  const deletedEvidence = await prisma.violationEvidenceImage.deleteMany();
  const deletedRecords = await prisma.violationRecord.deleteMany();
  const deletedAdjustments = await prisma.pointAdjustment.deleteMany();

  return NextResponse.json({
    ok: true,
    before: {
      evidence: beforeEvidence,
      records: beforeRecords,
      adjustments: beforeAdjustments,
    },
    deleted: {
      evidence: deletedEvidence.count,
      records: deletedRecords.count,
      adjustments: deletedAdjustments.count,
    },
  });
}
