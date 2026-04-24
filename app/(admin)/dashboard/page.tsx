import { prisma } from "@/lib/prisma";
import { getEffectivePointsMap } from "@/lib/student-effective-points";

async function getDashboardData() {
  const [totalStudents, totalTeachers, records, violationTypes, effectivePointsMap] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", active: true } }),
    prisma.user.count({ where: { role: { in: ["TEACHER", "SUPER_ADMIN"] }, active: true } }),
    prisma.violationRecord.findMany({ include: { student: { include: { class: true } }, violationType: true }, orderBy: { date: "desc" } }),
    prisma.violationType.findMany({ where: { active: true } }),
    getEffectivePointsMap(),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthRecords = records.filter(r => r.date >= startOfMonth);
  const lastMonthRecords = records.filter(r => r.date >= lastMonth && r.date <= endLastMonth);

  // Students with effective total points (termasuk pengurangan bulan tenang)
  const studentPointsMap = new Map<string, { student: any; total: number }>();
  for (const r of records) {
    if (studentPointsMap.has(r.studentId)) continue;
    studentPointsMap.set(r.studentId, {
      student: r.student,
      total: effectivePointsMap.get(r.studentId) ?? 0,
    });
  }
  const criticalStudents = Array.from(studentPointsMap.values())
    .filter(s => s.total >= parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75"))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const topStudents = Array.from(studentPointsMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Monthly trend (last 6 months)
  const monthlyData: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const count = records.filter(r => r.date >= d && r.date <= end).length;
    monthlyData.push({ label: d.toLocaleString("id-ID", { month: "short" }), count });
  }

  // Top violation types this month
  const vtCount = new Map<string, { name: string; count: number }>();
  for (const r of thisMonthRecords) {
    const existing = vtCount.get(r.violationTypeId);
    if (existing) existing.count++; else vtCount.set(r.violationTypeId, { name: r.violationType.name, count: 1 });
  }
  const topViolations = Array.from(vtCount.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  return { totalStudents, totalTeachers, thisMonthCount: thisMonthRecords.length, lastMonthCount: lastMonthRecords.length, criticalStudents, topStudents, monthlyData, topViolations };
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
  const maxCount = Math.max(...monthlyData.map(m => m.count), 1);
  const trend = lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount * 100).toFixed(0) : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Dashboard Pelanggaran</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ringkasan data seluruh siswa · Tahun Ajaran 2025/2026</p>
      </div>

      {/* Stats */}
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
        {/* Chart */}
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

        {/* Top violations */}
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

      {/* Top Students */}
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
