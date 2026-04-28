import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quietPeriodDays } from "@/lib/student-effective-points";
import { previewEligibleQuietMonthStudents } from "@/lib/quiet-month-reduction";

/** Super admin: siapa saja yang akan dapat remisi jika job dijalankan (tanpa mengubah data). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eligible = await previewEligibleQuietMonthStudents();
  return NextResponse.json({
    quietDays: quietPeriodDays(),
    eligibleCount: eligible.length,
    eligible,
  });
}
