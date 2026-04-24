import { prisma } from "@/lib/prisma";
import RecordsClient from "./RecordsClient";
import type { Prisma } from "@prisma/client";
import type { RecordsRow } from "./records-view";
import { getEffectivePointsMap } from "@/lib/student-effective-points";

export default async function RecordsPage({ searchParams }: { searchParams: { grade?: string; classId?: string; search?: string; page?: string } }) {
  const page = parseInt(searchParams.page || "1", 10);
  const perPage = 15;
  const rosterMode = Boolean(searchParams.grade || searchParams.classId);

  const studentWhere: Prisma.UserWhereInput = {
    role: "STUDENT",
    active: true,
  };
  if (searchParams.classId) studentWhere.classId = searchParams.classId;
  if (searchParams.grade) studentWhere.class = { grade: searchParams.grade };
  if (searchParams.search) {
    studentWhere.name = { contains: searchParams.search, mode: "insensitive" };
  }

  const [classes, violationTypes, studentsForPicker, totalPointsMap] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.violationType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "STUDENT", active: true },
      select: { id: true, name: true, nisn: true, class: { select: { name: true, grade: true } } },
      orderBy: { name: "asc" },
    }),
    getEffectivePointsMap(),
  ]);

  let rows: RecordsRow[] = [];
  let total = 0;

  if (rosterMode) {
    const students = await prisma.user.findMany({
      where: studentWhere,
      include: { class: true },
      orderBy: { name: "asc" },
    });
    const studentIds = students.map((s) => s.id);
    const recordsInScope =
      studentIds.length === 0
        ? []
        : await prisma.violationRecord.findMany({
            where: { studentId: { in: studentIds } },
            include: { student: { include: { class: true } }, violationType: true },
            orderBy: { createdAt: "desc" },
          });

    const byStudent = new Map<string, typeof recordsInScope>();
    for (const r of recordsInScope) {
      const list = byStudent.get(r.studentId) ?? [];
      list.push(r);
      byStudent.set(r.studentId, list);
    }

    for (const st of students) {
      const rs = byStudent.get(st.id);
      if (rs?.length) {
        const sorted = [...rs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        for (const r of sorted) rows.push({ type: "record", record: r });
      } else {
        rows.push({ type: "placeholder", student: st });
      }
    }
    total = rows.length;
    rows = rows.slice((page - 1) * perPage, page * perPage);
  } else {
    const recordWhere: Prisma.ViolationRecordWhereInput = {};
    const studentNested: Prisma.UserWhereInput = {};
    if (searchParams.search) {
      studentNested.name = { contains: searchParams.search, mode: "insensitive" };
    }
    if (searchParams.classId) {
      studentNested.classId = searchParams.classId;
    }
    if (searchParams.grade) {
      studentNested.class = { grade: searchParams.grade };
    }
    if (Object.keys(studentNested).length > 0) {
      recordWhere.student = studentNested;
    }

    const [records, count] = await Promise.all([
      prisma.violationRecord.findMany({
        where: recordWhere,
        include: { student: { include: { class: true } }, violationType: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.violationRecord.count({ where: recordWhere }),
    ]);
    total = count;
    rows = records.map((record) => ({ type: "record", record }));
  }

  return (
    <RecordsClient
      rows={rows}
      total={total}
      page={page}
      perPage={perPage}
      classes={classes}
      violationTypes={violationTypes}
      studentsForPicker={studentsForPicker}
      totalPointsMap={Object.fromEntries(totalPointsMap)}
      searchParams={searchParams}
      rosterMode={rosterMode}
    />
  );
}
