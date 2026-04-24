import { prisma } from "@/lib/prisma";
import { getEffectivePointsMap } from "@/lib/student-effective-points";

export const dynamic = "force-dynamic";

const CRITICAL_POINTS = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75", 10);

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
    ...monthCounts
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", active: true } }),
    prisma.user.count({ where: { role: { in: ["TEACHER", "SUPER_ADMIN"] }, active: true } }),
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
  const needIdSet = new Set<string>();
  top5.forEach((x) => needIdSet.add(x.studentId));
  criticalRanked.forEach((x) => needIdSet.add(x.studentId));
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

  return {
    totalStudents,
    totalTeachers,
    thisMonthCount,
    lastMonthCount,
    criticalStudents,
    topStudents,
    monthlyData,
    topViolations,
  };
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="text-xs mb-1.5 tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-3xl font-serif" style={{ color: color || "var(--text-primary)" }}>{value}</div>
      {sub && <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function PointBadge({ points }: { points: number }) {
  const c = points >= 75 ? ["var(--danger-bg)", "var(--danger)"] : points >= 50 ? ["var(--warning-bg)", "var(--warning)"] : ["var(--success-bg)", "var(--success)"];
  return <span className="inline-flex items-center justify-center w-9 h-5 rounded-full text-xs font-bold" style={{ background: c[0], color: c[1] }}>{points}</span>;
}

function StatusBadge({ points }: { points: number }) {
  const s = points >= 75 ? ["var(--danger-bg)", "var(--danger)", "Kritis"] : points >= 50 ? ["var(--warning-bg)", "var(--warning)", "Perhatian"] : ["var(--success-bg)", "var(--success)", "Normal"];
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: s[0], color: s[1] }}>{s[2]}</span>;
}

export default async function DashboardPage() {
  const { totalStudents, totalTeachers, thisMonthCount, lastMonthCount, criticalStudents, topStudents, monthlyData, topViolations } = await getDashboardData();
  const maxCount = Math.max(...monthlyData.map((m) => m.count), 1);
  const trend = lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount * 100).toFixed(0) : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Dashboard Pelanggaran</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ringkasan data seluruh siswa · Tahun Ajaran 2025/2026</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Siswa Aktif" value={totalStudents} sub={`${totalTeachers} guru / staff`} />
        <StatCard label="Pelanggaran Bulan Ini" value={thisMonthCount} sub={trend ? `${parseInt(trend) > 0 ? "+" : ""}${trend}% dari bulan lalu` : undefined} color="var(--warning)" />
        <StatCard label="Siswa Poin Kritis (≥75)" value={criticalStudents.length} sub="Perlu tindak lanjut" color="var(--danger)" />
        <StatCard
          label="Jumlah Poin Efektif (Top 5)"
          value={topStudents.reduce((s, x) => s + x.total, 0)}
          sub="Termasuk potongan periode tenang bila ada"
          color="var(--success)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Pelanggaran per Bulan (6 Bulan Terakhir)</div>
          <div className="flex items-end gap-2 h-24 px-1">
            {monthlyData.map((m, i) => {
              const h = maxCount > 0 ? Math.max((m.count / maxCount) * 100, 4) : 4;
              const isLast = i === monthlyData.length - 1;
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
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

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>Siswa Poin Tertinggi</h2>
        </div>
        <table className="w-full">
          <thead><tr style={{ background: "var(--bg-primary)" }}>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Nama Siswa</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Kelas</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Total Poin</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Status</th>
          </tr></thead>
          <tbody>
            {topStudents.map(({ student, total }) => (
              <tr key={student.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{student.name}</td>
                <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: "var(--text-secondary)" }}>{student.class?.name || "—"}</td>
                <td className="px-4 py-3"><PointBadge points={total} /></td>
                <td className="px-4 py-3"><StatusBadge points={total} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
