import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { startOfSchoolDay } from "@/lib/staff-submission-notifications";

export const dynamic = "force-dynamic";

const LIMIT = 200;

import { formatClassLabel } from "@/lib/class-label";

function classLabel(c: { grade: string; name: string; major: string } | null): string | null {
  if (!c) return null;
  const label = formatClassLabel(c, "");
  return label || null;
}

/**
 * Daftar catatan pelanggaran hari ini untuk lonceng + halaman monitoring.
 * Semua sumber (portal siswa maupun input staf); otomatis kosong setelah berganti hari.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = startOfSchoolDay();

  const rows = await prisma.violationRecord.findMany({
    where: {
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      date: true,
      createdAt: true,
      points: true,
      submittedByStudent: true,
      createdByName: true,
      student: {
        select: {
          id: true,
          name: true,
          photoPresent: true,
          class: { select: { grade: true, name: true, major: true } },
        },
      },
      violationType: { select: { name: true } },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    studentId: r.student.id,
    studentName: r.student.name,
    studentPhotoPresent: r.student.photoPresent,
    classLabel: classLabel(r.student.class),
    violationName: r.violationType.name,
    points: r.points,
    incidentDate: r.date.toISOString(),
    createdAt: r.createdAt.toISOString(),
    submittedByStudent: r.submittedByStudent,
    createdByName: r.createdByName,
  }));

  const latest = rows[0];
  const revision = latest != null ? `${latest.id}:${latest.createdAt.toISOString()}:${rows.length}` : "none";

  return NextResponse.json({ revision, items, since: since.toISOString() });
}
