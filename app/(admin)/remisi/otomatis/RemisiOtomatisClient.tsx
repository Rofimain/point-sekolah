"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaginationBar } from "@/components/PaginationBar";
import { calendarTodayYmd } from "@/lib/incident-date";
import { formatDateTime } from "@/lib/utils";
import { formatYmdIndonesia } from "@/lib/point-adjustment-reason";

type ClassOpt = { id: string; name: string };
type Row = {
  id: string;
  studentId: string;
  studentName: string;
  className: string | null;
  step: number | null;
  bersihSejak: string | null;
  effectiveYmd: string;
  effectiveBefore: number | null;
  pointsDelta: number;
  effectiveAfter: number | null;
  status: "berlaku" | "susulan" | "dibatalkan";
  sebab: string | null;
  createdAt: string;
  legacy: boolean;
};

const STATUS_LABEL = { berlaku: "Berlaku", susulan: "Susulan", dibatalkan: "Dibatalkan" } as const;

function monthRange() {
  const today = calendarTodayYmd();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export default function RemisiOtomatisClient({
  isSuperAdmin,
  aktif,
  classes,
}: {
  isSuperAdmin: boolean;
  aktif: boolean;
  classes: ClassOpt[];
}) {
  const router = useRouter();
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("semua");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ siswa: 0, totalPoin: 0, dibatalkan: 0, siswaNol: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ type: "auto", from, to, page: String(page), pageSize: "20", status });
      if (classId) sp.set("classId", classId);
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/remisi?${sp}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal memuat riwayat");
      setRows(data.rows ?? []);
      setTotalPages(data.totalPages ?? 1);
      setSummary(data.summary ?? { siswa: 0, totalPoin: 0, dibatalkan: 0, siswaNol: 0 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, [from, to, classId, status, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function terapkan() {
    if (!window.confirm("Terapkan remisi berantai sekali untuk semua siswa? Pastikan basis data sudah dicadangkan.")) return;
    setApplying(true);
    try {
      const res = await fetch("/api/remisi/activation", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menerapkan");
      toast.success(`Remisi berantai aktif. ${data.created ?? 0} tahap dicatat.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menerapkan");
    } finally {
      setApplying(false);
    }
  }

  function exportHref() {
    const sp = new URLSearchParams({ type: "auto", from, to, status });
    if (classId) sp.set("classId", classId);
    if (q.trim()) sp.set("q", q.trim());
    return `/api/remisi/export?${sp}`;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Riwayat Remisi Otomatis</h1>
          <p className="page-subtitle">Potongan 25% berantai tiap bulan kalender sejak tanggal kejadian.</p>
        </div>
        <a href={exportHref()} className="btn btn-secondary btn-sm">
          Ekspor Excel
        </a>
      </div>

      {!aktif && isSuperAdmin ? (
        <div className="card mb-5 space-y-3 p-5">
          <h2 className="text-sm font-semibold">Penerapan awal aturan remisi berantai</h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Sekali dijalankan, sistem mencatat tahap remisi yang sudah jatuh tempo (termasuk susulan) dan mengulang
            tiap bulan sampai poin habis. Cadangkan basis data sebelum menerapkan.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/remisi/activation?format=xlsx" className="btn btn-secondary btn-sm">
              Pratinjau (Excel)
            </a>
            <button type="button" className="btn btn-primary btn-sm" disabled={applying} onClick={() => void terapkan()}>
              {applying ? "Menerapkan..." : "Terapkan sekali"}
            </button>
          </div>
        </div>
      ) : null}

      {!aktif && !isSuperAdmin ? (
        <div className="card mb-5 p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Aturan berantai belum diaktifkan.
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Siswa diremisi" value={summary.siswa} />
        <Stat label="Total poin dipotong" value={summary.totalPoin} />
        <Stat label="Dibatalkan" value={summary.dibatalkan} />
        <Stat label="Siswa poin jadi 0" value={summary.siswaNol} />
      </div>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="label">
          Dari
          <input className="input mt-1" type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        </label>
        <label className="label">
          Sampai
          <input className="input mt-1" type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </label>
        <label className="label">
          Kelas
          <select className="select mt-1" value={classId} onChange={(e) => { setPage(1); setClassId(e.target.value); }}>
            <option value="">Semua kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Status
          <select className="select mt-1" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="semua">Semua</option>
            <option value="berlaku">Berlaku</option>
            <option value="susulan">Susulan</option>
            <option value="dibatalkan">Dibatalkan</option>
          </select>
        </label>
        <label className="label">
          Cari nama
          <input className="input mt-1" value={q} placeholder="Nama siswa" onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-elegant min-w-[920px]">
            <thead>
              <tr>
                {["Tanggal berlaku", "Siswa", "Kelas", "Tahap", "Bersih sejak", "Poin", "Potongan", "Status", "Dicatat"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    {loading ? "Memuat..." : "Tidak ada remisi otomatis pada rentang ini."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 text-sm">{formatYmdIndonesia(r.effectiveYmd)}</td>
                    <td className="px-3 text-sm">
                      <Link href={`/students/${r.studentId}/poin`} className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                        {r.studentName}
                      </Link>
                    </td>
                    <td className="px-3 text-sm">{r.className ?? "—"}</td>
                    <td className="px-3 text-sm">
                      {r.legacy ? "—" : r.step}
                      {r.legacy ? <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>aturan lama</div> : null}
                    </td>
                    <td className="px-3 text-sm">{r.bersihSejak ?? "—"}</td>
                    <td className="px-3 text-sm tabular-nums">
                      {r.effectiveBefore == null ? "—" : `${r.effectiveBefore} → ${r.effectiveAfter}`}
                    </td>
                    <td className="px-3 text-sm tabular-nums">{r.pointsDelta}</td>
                    <td className="px-3 text-sm">
                      <span className={`badge-soft ${r.status === "dibatalkan" ? "badge-danger" : r.status === "susulan" ? "badge-warning" : "badge-success"}`} title={r.sebab ?? undefined}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.sebab ? <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{r.sebab}</div> : null}
                    </td>
                    <td className="px-3 text-sm">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
