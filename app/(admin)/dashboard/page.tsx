import { prisma } from "@/lib/prisma";
import { getEffectivePointsMap } from "@/lib/student-effective-points";
import { getAppSetting, APP_KEYS } from "@/lib/app-settings";
import { indonesianAcademicYearLabel } from "@/lib/academic-year";
import { reviewStatusLabel } from "@/lib/review-dates";
import DashboardRankedTables from "@/components/dashboard/DashboardRankedTables";

export const dynamic = "force-dynamic";

const CRITICAL_POINTS = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75", 10);
const ALERT_POINTS = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "25", 10);

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

  const [
    totalStudents,
    totalTeachers,
    thisMonthCount,
    lastMonthCount,
    vtGroups,
    effectivePointsMap,
    nextReviewViolations,
    nextReviewRoster,
    ...monthCounts
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", active: true } }),
    prisma.user.count({ where: { role: { not: "STUDENT" }, active: true } }),
    prisma.violationRecord.count({ where: { date: { gte: startOfMonth } } }),
    prisma.violationRecord.count({
      where: { date: { gte: lastMonthStart, lte: endLastMonth } },
    }),
    prisma.violationRecord.groupBy({
      by: ["violationTypeId"],
      where: { date: { gte: startOfMonth } },
      _count: { id: true },
    }),
    getEffectivePointsMap(),
    getAppSetting(APP_KEYS.NEXT_REVIEW_VIOLATIONS),
    getAppSetting(APP_KEYS.NEXT_REVIEW_ROSTER),
    ...monthRanges.map(({ d, end }) =>
      prisma.violationRecord.count({ where: { date: { gte: d, lte: end } } })
    ),
  ]);

  const monthlyData = monthRanges.map((mr, i) => ({
    label: mr.label,
    count: monthCounts[i] ?? 0,
  }));

  const sortedVt = [...vtGroups].sort((a, b) => b._count.id - a._count.id).slice(0, 5);
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

  const ranked = Array.from(effectivePointsMap.entries())
    .map(([studentId, total]) => ({ studentId, total }))
    .sort((a, b) => b.total - a.total);

  const top5 = ranked.slice(0, 5);
  const criticalRanked = ranked.filter((x) => x.total >= CRITICAL_POINTS).slice(0, 10);
  const over25Ranked = ranked.filter((x) => x.total >= ALERT_POINTS);
  const needIdSet = new Set<string>();
  top5.forEach((x) => needIdSet.add(x.studentId));
  criticalRanked.forEach((x) => needIdSet.add(x.studentId));
  over25Ranked.forEach((x) => needIdSet.add(x.studentId));
  const needIds = Array.from(needIdSet);

  const users =
    needIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: needIds } },
          include: { class: { select: { name: true } } },
        });
  const userById = new Map(users.map((u) => [u.id, u]));

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
    nextReviewViolations,
    nextReviewRoster,
  };
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="panel p-3 sm:p-4">
      <div className="text-[11px] sm:text-xs mb-1.5 tracking-wide leading-snug" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-serif font-semibold sm:text-3xl" style={{ color: color || "var(--text-primary)" }}>
        {value}
      </div>
      {sub && (
        <div className="text-[9px] sm:text-[10px] mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>
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
    nextReviewViolations,
    nextReviewRoster,
  } = await getDashboardData();
  const maxCount = Math.max(...monthlyData.map((m) => m.count), 1);
  const trend = lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount * 100).toFixed(0) : null;

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
      <div className="mb-5">
        <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>Dashboard Pelanggaran</h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Ringkasan data seluruh siswa · Tahun Ajaran {indonesianAcademicYearLabel()}
        </p>
      </div>

      {(nextReviewViolations.trim() || nextReviewRoster.trim()) && (
        <div
          className="mb-4 rounded-xl border p-3 text-xs leading-relaxed"
          style={{
            background:
              reviewStatusLabel(nextReviewViolations) === "overdue" || reviewStatusLabel(nextReviewRoster) === "overdue"
                ? "var(--danger-bg)"
                : "var(--accent-light)",
            borderColor:
              reviewStatusLabel(nextReviewViolations) === "overdue" || reviewStatusLabel(nextReviewRoster) === "overdue"
                ? "var(--danger)"
                : "var(--accent-border)",
            color:
              reviewStatusLabel(nextReviewViolations) === "overdue" || reviewStatusLabel(nextReviewRoster) === "overdue"
                ? "var(--danger)"
                : "var(--accent)",
          }}
        >
          <strong>Pengingat pembaharuan:</strong>
          {nextReviewViolations.trim() ? (
            <span className="block mt-1">
              Review poin / jenis pelanggaran: {nextReviewViolations}
              {reviewStatusLabel(nextReviewViolations) === "overdue" ? " — terlewat, segera perbarui di Pengaturan" : ""}
              {reviewStatusLabel(nextReviewViolations) === "soon" ? " — kurang dari 30 hari" : ""}
            </span>
          ) : null}
          {nextReviewRoster.trim() ? (
            <span className="block mt-1">
              Review data murid dan guru: {nextReviewRoster}
              {reviewStatusLabel(nextReviewRoster) === "overdue" ? " — terlewat, segera perbarui di Pengaturan" : ""}
              {reviewStatusLabel(nextReviewRoster) === "soon" ? " — kurang dari 30 hari" : ""}
            </span>
          ) : null}
          <span className="block mt-1 opacity-90">Atur / perpanjang (+6 bulan / +1 tahun) di Pengaturan sekolah (super admin).</span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Siswa Aktif" value={totalStudents} sub={`${totalTeachers} staf (guru / admin / super admin)`} />
        <StatCard label="Pelanggaran Bulan Ini" value={thisMonthCount} sub={trend ? `${parseInt(trend) > 0 ? "+" : ""}${trend}% dari bulan lalu` : undefined} color="var(--warning)" />
        <StatCard label={`Siswa poin ≥${ALERT_POINTS}`} value={over25Students.length} sub="Perhatian wali kelas / BK" color="var(--warning)" />
        <StatCard label={`Siswa poin kritis (≥${CRITICAL_POINTS})`} value={criticalStudents.length} sub="Tindak lanjut segera" color="var(--danger)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Pelanggaran per Bulan (6 Bulan Terakhir)</div>
          <div className="flex h-24 min-w-0 items-end gap-1 px-0.5 sm:gap-2 sm:px-1">
            {monthlyData.map((m, i) => {
              const h = maxCount > 0 ? Math.max((m.count / maxCount) * 100, 4) : 4;
              const isLast = i === monthlyData.length - 1;
              return (
                <div key={m.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.count}</span>
                  <div className="w-full rounded-t" style={{ height: `${h}%`, background: isLast ? "var(--accent)" : "var(--accent-light)", border: `1px solid var(--accent-border)`, minHeight: 4 }} />
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Top Jenis Pelanggaran Bulan Ini</div>
          {topViolations.length === 0 ? (
            <div className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Tidak ada data bulan ini</div>
          ) : (
            <div className="space-y-2">
              {topViolations.map((v) => (
                <div key={v.name} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs truncate mr-2" style={{ color: "var(--text-secondary)" }}>{v.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>{v.count} kasus</span>
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
