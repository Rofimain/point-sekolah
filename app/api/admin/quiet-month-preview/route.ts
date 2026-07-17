import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getQuietPeriodDays, getRemisiPercent } from "@/lib/app-settings";
import { previewEligibleQuietMonthStudents } from "@/lib/quiet-month-reduction";
import { canManageData } from "@/lib/staff-roles";

/** Super admin / admin: siapa saja yang akan dapat remisi jika job dijalankan (tanpa mengubah data). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [eligible, quietDays, remisiPercent] = await Promise.all([
    previewEligibleQuietMonthStudents(),
    getQuietPeriodDays(),
    getRemisiPercent(),
  ]);
  return NextResponse.json({
    quietDays,
    remisiPercent,
    eligibleCount: eligible.length,
    eligible,
  });
}
