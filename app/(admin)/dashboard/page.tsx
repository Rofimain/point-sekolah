import { prisma } from "@/lib/prisma";
import { getEffectivePointsMap } from "@/lib/student-effective-points";
import { indonesianAcademicYearLabel } from "@/lib/academic-year";
import DashboardRankedTables from "@/components/dashboard/DashboardRankedTables";
import { visibleViolationRecordWhere } from "@/lib/record-visibility";

export const dynamic = "force-dynamic";

const CRITICAL_POINTS = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75", 10);
const ALERT_POINTS = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "50", 10);

async function getDashboardData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
    return {
      d,
      end,
      label: d.toLocaleString("id-ID", { month: "short" }),
    };
  });

  const [totalStudents, totalTeachers, thisMonthCount, lastMonthCount, vtGroups, effectivePointsMap, ...monthCounts] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE", deletedAt: null } }),
      prisma.user.count({ where: { role: { not: "STUDENT" }, status: "ACTIVE", deletedAt: null } }),
      prisma.violationRecord.count({
        where: visibleViolationRecordWhere({ date: { gte: startOfMonth } }),
      }),
      prisma.violationRecord.count({
        where: visibleViolationRecordWhere({ date: { gte: lastMonthStart, lte: endLastMonth } }),
      }),
      prisma.violationRecord.groupBy({
        by: ["violationTypeId"],
        where: visibleViolationRecordWhere({ date: { gte: startOfMonth } }),
        _count: { id: true },
      }),
      getEffectivePointsMap(),
      ...monthRanges.map(({ d, end }) =>
        prisma.violationRecord.count({
          where: visibleViolationRecordWhere({ date: { gte: d, lte: end } }),
        })
      ),
    ]);

  const monthlyData = monthRanges.map((mr, i) => ({
    label: mr.label,
    count: monthCounts[i] ?? 0,
  }));

  const sortedVt = [...vtGroups]
    .sort((a, b) => b._count.id - a._count.id || a.violationTypeId.localeCompare(b.violationTypeId))
    .slice(0, 5);
  const vtIds = sortedVt.map((g) => g.violationTypeId);
  const vtNames =
    vtIds.length === 0
      ? []
      : await prisma.violationType.findMany({
          where: { id: { in: vtIds } },
          select: { id: true, name: true },
        });
  const nameById = new Map(vtNames.map((t) => [t.id, t.name]));
  const topViolations = sortedVt.map((g) => ({
    name: nameById.get(g.violationTypeId) ?? "—",
    count: g._count.id,
  }));

  const unsortedRanked = Array.from(effectivePointsMap.entries()).map(([studentId, total]) => ({ studentId, total }));
  const needIds = unsortedRanked.map((entry) => entry.studentId);

  const users =
    needIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: needIds } },
          include: { class: { select: { name: true } } },
        });
  const userById = new Map(users.map((u) => [u.id, u]));
  const ranked = unsortedRanked
    .filter((entry) => userById.has(entry.studentId))
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      const aName = userById.get(a.studentId)?.name ?? "";
      const bName = userById.get(b.studentId)?.name ?? "";
      return aName.localeCompare(bName, "id") || a.studentId.localeCompare(b.studentId);
    });
  const top5 = ranked.slice(0, 5);
  const criticalRanked = ranked.filter((entry) => entry.total >= CRITICAL_POINTS).slice(0, 10);
  const over25Ranked = ranked.filter((entry) => entry.total >= ALERT_POINTS);

  const topStudents = top5
    .map((x) => {
      const student = userById.get(x.studentId);
      return student ? { student, total: x.total } : null;
    })
    .filter(Boolean) as { student: (typeof users)[0]; total: number }[];

  const criticalStudents = criticalRanked
    .map((x) => {
      const student = userById.get(x.studentId);
      return student ? { student, total: x.total } : null;
    })
    .filter(Boolean) as { student: (typeof users)[0]; total: number }[];

  const over25Students = over25Ranked
    .map((x) => {
      const student = userById.get(x.studentId);
      return student ? { student, total: x.total } : null;
    })
    .filter(Boolean) as { student: (typeof users)[0]; total: number }[];

  return {
    totalStudents,
    totalTeachers,
    thisMonthCount,
    lastMonthCount,
    criticalStudents,
    over25Students,
    topStudents,
    monthlyData,
    topViolations,
  };
}

function StatIcon({ kind }: { kind: "students" | "month" | "alert" | "critical" }) {
  const common = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "students")
    return (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    );
  if (kind === "month")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  if (kind === "alert")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: "students" | "month" | "alert" | "critical";
}) {
  const tone = color || "var(--accent)";
  return (
    <div className="card relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, ${tone}, transparent 70%)`, opacity: 0.7 }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium leading-snug" style={{ color: "var(--text-muted)" }}>
          {label}
        </div>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ color: tone, background: `color-mix(in srgb, ${tone} 10%, transparent)` }}
        >
          <StatIcon kind={icon} />
        </span>
      </div>
      <div
        className="mt-2 font-serif text-[32px] font-semibold leading-none tabular-nums"
        style={{ color: color || "var(--text-primary)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const {
    totalStudents,
    totalTeachers,
    thisMonthCount,
    lastMonthCount,
    criticalStudents,
    over25Students,
    topStudents,
    monthlyData,
    topViolations,
  } = await getDashboardData();
  const maxCount = Math.max(...monthlyData.map((m) => m.count), 1);
  const trend = lastMonthCount > 0 ? (((thisMonthCount - lastMonthCount) / lastMonthCount) * 100).toFixed(0) : null;

  const over25Rows = over25Students.map(({ student, total }) => ({
    id: student.id,
    name: student.name,
    className: student.class?.name ?? null,
    total,
  }));
  const top5Rows = topStudents.map(({ student, total }) => ({
    id: student.id,
    name: student.name,
    className: student.class?.name ?? null,
    total,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Dashboard Pelanggaran</h1>
        <p className="page-subtitle">Ringkasan data seluruh siswa · Tahun Ajaran {indonesianAcademicYearLabel()}</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Siswa Aktif"
          value={totalStudents}
          sub={`${totalTeachers} staf (guru / admin / super admin)`}
          icon="students"
        />
        <StatCard
          label="Pelanggaran Bulan Ini"
          value={thisMonthCount}
          sub={trend ? `${parseInt(trend) > 0 ? "+" : ""}${trend}% dari bulan lalu` : undefined}
          color="var(--warning)"
          icon="month"
        />
        <StatCard
          label={`Siswa poin ≥${ALERT_POINTS}`}
          value={over25Students.length}
          sub="Perhatian wali kelas / BK"
          color="var(--warning)"
          icon="alert"
        />
        <StatCard
          label={`Siswa poin kritis (≥${CRITICAL_POINTS})`}
          value={criticalStudents.length}
          sub="Tindak lanjut segera"
          color="var(--danger)"
          icon="critical"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-5 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Pelanggaran per Bulan (6 Bulan Terakhir)
          </div>
          <div className="flex h-28 min-w-0 items-end gap-1.5 px-0.5 sm:gap-3 sm:px-1">
            {monthlyData.map((m, i) => {
              const h = maxCount > 0 ? Math.max((m.count / maxCount) * 100, 4) : 4;
              const isLast = i === monthlyData.length - 1;
              return (
                <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                  <span
                    className="text-[11px] font-medium tabular-nums"
                    style={{ color: isLast ? "var(--accent)" : "var(--text-secondary)" }}
                  >
                    {m.count}
                  </span>
                  <div
                    className="w-full rounded-t-md transition-[height]"
                    style={{
                      height: `${h}%`,
                      background: isLast ? "var(--accent)" : "color-mix(in srgb, var(--accent) 22%, transparent)",
                      minHeight: 4,
                    }}
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Top Jenis Pelanggaran Bulan Ini
          </div>
          {topViolations.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Tidak ada data bulan ini
            </div>
          ) : (
            <div>
              {topViolations.map((v, i) => (
                <div
                  key={v.name}
                  className="flex min-w-0 items-center justify-between gap-3 py-2.5"
                  style={{ borderBottom: i < topViolations.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text-secondary)" }}>
                    {v.name}
                  </span>
                  <span className="badge-soft badge-warning whitespace-nowrap">{v.count} kasus</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DashboardRankedTables
        over25={over25Rows}
        top5={top5Rows}
        alertPoints={ALERT_POINTS}
        criticalPoints={CRITICAL_POINTS}
      />
    </div>
  );
}
