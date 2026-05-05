import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

/**
 * Ringkasannya untuk polling ringan di dashboard staf: revisi berubah jika ada laporan baru dari siswa.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const latest = await prisma.violationRecord.findFirst({
    where: { submittedByStudent: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      points: true,
      student: { select: { name: true } },
      violationType: { select: { name: true } },
    },
  });

  if (!latest) {
    return NextResponse.json({
      revision: "none",
      preview: null,
    });
  }

  return NextResponse.json({
    revision: `${latest.id}:${latest.createdAt.toISOString()}`,
    preview: {
      studentName: latest.student.name,
      violationName: latest.violationType.name,
      points: latest.points,
    },
  });
}
