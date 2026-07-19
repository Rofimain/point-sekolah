import { prisma } from "@/lib/prisma";
import RecordsClient from "./RecordsClient";
import type { Prisma } from "@/generated/prisma/client";
import { RECORD_LIST_SELECT, RECORD_STUDENT_SELECT, type RecordsRow } from "./records-view";
import { getEffectivePointsMap } from "@/lib/student-effective-points";
import { getSafeServerSession } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { listViolationBagian } from "@/lib/violation-bagian";
import { visibleViolationRecordWhere } from "@/lib/record-visibility";

export const dynamic = "force-dynamic";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; classId?: string; search?: string; page?: string }>;
}) {
  const query = await searchParams;
  const session = await getSafeServerSession();
  const page = parseInt(query.page || "1", 10);
  const perPage = 15;
  const rosterMode = Boolean(query.grade || query.classId);

  const studentWhere: Prisma.UserWhereInput = {
    role: "STUDENT",
    status: "ACTIVE",
    deletedAt: null,
  };
  if (query.classId) studentWhere.classId = query.classId;
  if (query.grade) studentWhere.class = { grade: query.grade };
  if (query.search) {
    studentWhere.name = { contains: query.search, mode: "insensitive" };
  }

  const [classes, violationTypes, studentsForPicker, totalPointsMap, bagian] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.violationType.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { points: "asc" }] }),
    prisma.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE", deletedAt: null },
      select: {
        id: true,
        name: true,
        nisn: true,
        photoPresent: true,
        class: { select: { name: true, grade: true } },
      },
      orderBy: { name: "asc" },
    }),
    getEffectivePointsMap(),
    listViolationBagian(),
  ]);

  let rows: RecordsRow[] = [];
  let total = 0;

  if (rosterMode) {
    const ROSTER_RECORDS_PER_STUDENT = 40;
    const [studentCount, students] = await Promise.all([
      prisma.user.count({ where: studentWhere }),
      prisma.user.findMany({
        where: studentWhere,
        select: RECORD_STUDENT_SELECT,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);
    const studentIds = students.map((s) => s.id);
    /** Satu query batch (hindari N+1); ambil max 40 terbaru per siswa di memori. */
    const recordsFetched =
      studentIds.length === 0
        ? []
        : await prisma.violationRecord.findMany({
            where: { studentId: { in: studentIds }, deletedAt: null },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: RECORD_LIST_SELECT,
          });

    const byStudent = new Map<string, typeof recordsFetched>();
    for (const r of recordsFetched) {
      const list = byStudent.get(r.studentId) ?? [];
      if (list.length >= ROSTER_RECORDS_PER_STUDENT) continue;
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
    total = studentCount;
  } else {
    const studentNested: Prisma.UserWhereInput = { deletedAt: null };
    if (query.search) {
      studentNested.name = { contains: query.search, mode: "insensitive" };
    }
    if (query.classId) {
      studentNested.classId = query.classId;
    }
    if (query.grade) {
      studentNested.class = { grade: query.grade };
    }
    const recordWhere = visibleViolationRecordWhere({ student: studentNested });

    const [records, count] = await Promise.all([
      prisma.violationRecord.findMany({
        where: recordWhere,
        select: RECORD_LIST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
      bagian={bagian}
      studentsForPicker={studentsForPicker}
      totalPointsMap={Object.fromEntries(totalPointsMap)}
      searchParams={query}
      rosterMode={rosterMode}
      canManage={canManageData(session?.user?.role)}
    />
  );
}
