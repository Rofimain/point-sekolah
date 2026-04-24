import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  const { gross, adjustmentSum, effective } = await getEffectivePointsBreakdown(studentId);
  return NextResponse.json({ total: effective, gross, adjustmentSum });
}
