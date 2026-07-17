import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { startOfSchoolDay } from "@/lib/staff-submission-notifications";

export const dynamic = "force-dynamic";

const LIMIT = 200;

function classLabel(c: { grade: string; name: string; major: string } | null): string | null {
  if (!c) return null;
  const parts = [c.grade, c.name, c.major].filter((x) => x?.trim());
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Daftar laporan dari siswa untuk lonceng + halaman monitoring.
 * Hanya hari ini (zona sekolah); otomatis kosong setelah berganti hari.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = startOfSchoolDay();

  const rows = await prisma.violationRecord.findMany({
    where: {
      submittedByStudent: true,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      date: true,
      createdAt: true,
      points: true,
      student: {
        select: {
          name: true,
          class: { select: { grade: true, name: true, major: true } },
        },
      },
      violationType: { select: { name: true } },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    studentName: r.student.name,
    classLabel: classLabel(r.student.class),
    violationName: r.violationType.name,
    points: r.points,
    incidentDate: r.date.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  const latest = rows[0];
  const revision =
    latest != null ? `${latest.id}:${latest.createdAt.toISOString()}:${rows.length}` : "none";

  return NextResponse.json({ revision, items, since: since.toISOString() });
}
