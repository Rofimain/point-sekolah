import { prisma } from "@/lib/prisma";
import RecordsClient from "./RecordsClient";

export default async function RecordsPage({ searchParams }: { searchParams: { grade?: string; classId?: string; search?: string; page?: string } }) {
  const page = parseInt(searchParams.page || "1");
  const perPage = 15;

  const where: any = {};
  if (searchParams.search) {
    where.student = { name: { contains: searchParams.search, mode: "insensitive" } };
  }
  if (searchParams.classId) {
    where.student = { ...where.student, classId: searchParams.classId };
  }
  if (searchParams.grade) {
    where.student = { ...where.student, class: { grade: searchParams.grade } };
  }

  const [records, total, classes, violationTypes] = await Promise.all([
    prisma.violationRecord.findMany({
      where,
      include: { student: { include: { class: true } }, violationType: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.violationRecord.count({ where }),
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.violationType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // Compute total points per student for all records (not paginated)
  const allRecords = await prisma.violationRecord.findMany({ select: { studentId: true, points: true } });
  const totalPointsMap = new Map<string, number>();
  for (const r of allRecords) {
    totalPointsMap.set(r.studentId, (totalPointsMap.get(r.studentId) || 0) + r.points);
  }

  return (
    <RecordsClient
      records={records}
      total={total}
      page={page}
      perPage={perPage}
      classes={classes}
      violationTypes={violationTypes}
      totalPointsMap={Object.fromEntries(totalPointsMap)}
      searchParams={searchParams}
    />
  );
}
