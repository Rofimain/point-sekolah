import { prisma } from "@/lib/prisma";
import RecordsClient from "./RecordsClient";
import type { Prisma } from "@/generated/prisma/client";
import { RECORD_LIST_SELECT, RECORD_STUDENT_SELECT, type RecordsRow } from "./records-view";
import { getEffectivePointsMap } from "@/lib/student-effective-points";
import { getSafeServerSession } from "@/lib/auth";
import { canExportRecords, canManageData } from "@/lib/staff-roles";
import { listViolationBagian } from "@/lib/violation-bagian";
import { visibleViolationRecordWhere } from "@/lib/record-visibility";
import {
  parseRecordsListSort,
  sortRecordsListRows,
  sortRecordsRosterStudents,
} from "@/lib/records-list-sort";

export const dynamic = "force-dynamic";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    grade?: string;
    classId?: string;
    search?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const query = await searchParams;
  const session = await getSafeServerSession();
  const page = parseInt(query.page || "1", 10);
  const perPage = 15;
  const rosterMode = Boolean(query.grade || query.classId);
  const listSort = parseRecordsListSort(query.sort, query.dir);

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
    const [studentCount, allStudents] = await Promise.all([
      prisma.user.count({ where: studentWhere }),
      prisma.user.findMany({
        where: studentWhere,
        select: RECORD_STUDENT_SELECT,
      }),
    ]);
    total = studentCount;

    const allIds = allStudents.map((s) => s.id);
    const recordsFetched =
      allIds.length === 0
        ? []
        : await prisma.violationRecord.findMany({
            where: { studentId: { in: allIds }, deletedAt: null },
            orderBy: [{ date: "desc" }, { id: "desc" }],
            select: RECORD_LIST_SELECT,
          });

    const byStudent = new Map<string, typeof recordsFetched>();
    for (const r of recordsFetched) {
      const list = byStudent.get(r.studentId) ?? [];
      if (list.length >= ROSTER_RECORDS_PER_STUDENT) continue;
      list.push(r);
      byStudent.set(r.studentId, list);
    }

    const rankedStudents = sortRecordsRosterStudents(
      allStudents.map((st) => {
        const rs = byStudent.get(st.id) ?? [];
        const latest = rs[0];
        return {
          ...st,
          totalPoints: totalPointsMap.get(st.id) ?? 0,
          latestDate: latest?.date ?? null,
          latestViolationName: latest?.violationType.name ?? "",
        };
      }),
      listSort
    );

    const pageStudents = rankedStudents.slice((page - 1) * perPage, page * perPage);

    for (const st of pageStudents) {
      const rs = byStudent.get(st.id);
      if (rs?.length) {
        const sorted = [...rs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        for (const r of sorted) rows.push({ type: "record", record: r });
      } else {
        const student = allStudents.find((s) => s.id === st.id);
        if (student) rows.push({ type: "placeholder", student });
      }
    }
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

    const count = await prisma.violationRecord.count({ where: recordWhere });
    total = count;

    if (listSort.key === "date") {
      const records = await prisma.violationRecord.findMany({
        where: recordWhere,
        select: RECORD_LIST_SELECT,
        orderBy: [{ date: listSort.direction }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      });
      rows = records.map((record) => ({ type: "record", record }));
    } else if (listSort.key === "name") {
      const records = await prisma.violationRecord.findMany({
        where: recordWhere,
        select: RECORD_LIST_SELECT,
        orderBy: [{ student: { name: listSort.direction } }, { date: "desc" }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      });
      rows = records.map((record) => ({ type: "record", record }));
    } else if (listSort.key === "violation") {
      const records = await prisma.violationRecord.findMany({
        where: recordWhere,
        select: RECORD_LIST_SELECT,
        orderBy: [{ violationType: { name: listSort.direction } }, { date: "desc" }, { id: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      });
      rows = records.map((record) => ({ type: "record", record }));
    } else {
      const candidates = await prisma.violationRecord.findMany({
        where: recordWhere,
        select: {
          id: true,
          studentId: true,
          date: true,
          student: { select: { name: true } },
          violationType: { select: { name: true } },
        },
      });
      const ranked = sortRecordsListRows(
        candidates.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          studentName: r.student.name,
          violationName: r.violationType.name,
          date: r.date,
          totalPoints: totalPointsMap.get(r.studentId) ?? 0,
        })),
        listSort
      );
      const pageIds = ranked.slice((page - 1) * perPage, page * perPage).map((r) => r.id);
      if (pageIds.length === 0) {
        rows = [];
      } else {
        const fetched = await prisma.violationRecord.findMany({
          where: { id: { in: pageIds } },
          select: RECORD_LIST_SELECT,
        });
        const byId = new Map(fetched.map((r) => [r.id, r]));
        rows = pageIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((record) => ({ type: "record" as const, record: record! }));
      }
    }
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
      canExport={canExportRecords(session?.user?.role)}
    />
  );
}
