import { NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { AUTO_REMISI_PERCENT, AUTO_REMISI_QUIET_DAYS } from "@/lib/remisi-rules";
import { getQuietPeriodDays } from "@/lib/app-settings";
import { previewEligibleQuietMonthStudents } from "@/lib/quiet-month-reduction";

export async function GET() {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;

  const [eligible, quietDays] = await Promise.all([previewEligibleQuietMonthStudents(), getQuietPeriodDays()]);
  return NextResponse.json({
    quietDays,
    remisiPercent: AUTO_REMISI_PERCENT,
    ruleQuietDays: AUTO_REMISI_QUIET_DAYS,
    eligibleCount: eligible.length,
    eligible,
  });
}
