import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { isStaffRole } from "@/lib/staff-roles";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const allowed = isStaffRole(session.user.role) || session.user.id === studentId;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gross, adjustmentSum, effective } = await getEffectivePointsBreakdown(studentId);
  return NextResponse.json({ total: effective, gross, adjustmentSum });
}
