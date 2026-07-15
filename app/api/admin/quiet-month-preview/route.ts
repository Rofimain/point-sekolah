import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quietPeriodDays } from "@/lib/student-effective-points";
import { previewEligibleQuietMonthStudents } from "@/lib/quiet-month-reduction";
import { canManageData } from "@/lib/staff-roles";

/** Super admin: siapa saja yang akan dapat remisi jika job dijalankan (tanpa mengubah data). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eligible = await previewEligibleQuietMonthStudents();
  return NextResponse.json({
    quietDays: quietPeriodDays(),
    eligibleCount: eligible.length,
    eligible,
  });
}
