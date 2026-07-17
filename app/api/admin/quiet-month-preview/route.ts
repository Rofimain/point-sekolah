import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AUTO_REMISI_PERCENT, AUTO_REMISI_QUIET_DAYS } from "@/lib/remisi-rules";
import { getQuietPeriodDays } from "@/lib/app-settings";
import { previewEligibleQuietMonthStudents } from "@/lib/quiet-month-reduction";
import { canManageData } from "@/lib/staff-roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [eligible, quietDays] = await Promise.all([
    previewEligibleQuietMonthStudents(),
    getQuietPeriodDays(),
  ]);
  return NextResponse.json({
    quietDays,
    remisiPercent: AUTO_REMISI_PERCENT,
    ruleQuietDays: AUTO_REMISI_QUIET_DAYS,
    eligibleCount: eligible.length,
    eligible,
  });
}
