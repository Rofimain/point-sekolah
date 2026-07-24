import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudentsClient from "./StudentsClient";
import type { Prisma } from "@/generated/prisma/client";
import { indonesianAcademicYearLabel } from "@/lib/academic-year";
import { isStaffRole } from "@/lib/staff-roles";
import { getEffectivePointsMap } from "@/lib/student-effective-points";
import { getStudentEmailDomain } from "@/lib/school-config";
import { parseStudentsListSort, sortStudentsListRows } from "@/lib/students-list-sort";

const STUDENT_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  nisn: true,
  active: true,
  status: true,
  photoPresent: true,
  class: { select: { name: true, grade: true } },
} satisfies Prisma.UserSelect;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    tab?: string;
    classId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const query = await searchParams;
  const session = await getSafeServerSession();
  if (!session?.user?.role || !isStaffRole(session.user.role)) {
    redirect("/dashboard");
  }

  const page = parseInt(query.page || "1", 10);
  const perPage = 25;
  const listSort = parseStudentsListSort(query.sort, query.dir);
  const where: Prisma.UserWhereInput = { role: "STUDENT", deletedAt: null };
  if (query.classId) {
    where.classId = query.classId;
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nisn: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, classes, latestClass, effectivePointsMap] = await Promise.all([
    prisma.user.count({ where }),
    prisma.class.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.class.findFirst({ orderBy: { createdAt: "desc" }, select: { year: true } }),
    getEffectivePointsMap(),
  ]);

  let students: Prisma.UserGetPayload<{ select: typeof STUDENT_LIST_SELECT }>[];

  if (listSort.key === "name") {
    students = await prisma.user.findMany({
      where,
      select: STUDENT_LIST_SELECT,
      orderBy: [{ name: listSort.direction }, { id: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    });
  } else {
    const candidates = await prisma.user.findMany({
      where,
      select: { id: true, name: true },
    });
    const ranked = sortStudentsListRows(
      candidates.map((s) => ({
        id: s.id,
        name: s.name,
        points: effectivePointsMap.get(s.id) ?? 0,
      })),
      listSort
    );
    const pageIds = ranked.slice((page - 1) * perPage, page * perPage).map((r) => r.id);
    if (pageIds.length === 0) {
      students = [];
    } else {
      const fetched = await prisma.user.findMany({
        where: { id: { in: pageIds } },
        select: STUDENT_LIST_SELECT,
      });
      const byId = new Map(fetched.map((s) => [s.id, s]));
      students = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    }
  }

  const totalPointsMap: Record<string, number> = {};
  for (const s of students) {
    totalPointsMap[s.id] = effectivePointsMap.get(s.id) ?? 0;
  }

  const studentDomain = getStudentEmailDomain();
  const suggestedYear = latestClass?.year ?? indonesianAcademicYearLabel();

  return (
    <StudentsClient
      students={students}
      total={total}
      page={page}
      perPage={perPage}
      classes={classes}
      searchParams={query}
      studentDomain={studentDomain}
      viewerRole={session.user.role}
      suggestedYear={suggestedYear}
      totalPointsMap={totalPointsMap}
    />
  );
}
