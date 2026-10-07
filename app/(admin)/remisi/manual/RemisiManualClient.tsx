"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PaginationBar } from "@/components/PaginationBar";
import { calendarTodayYmd } from "@/lib/incident-date";
import { formatYmdIndonesia } from "@/lib/point-adjustment-reason";

type ClassOpt = { id: string; name: string };
type Row = {
  id: string;
  studentId: string;
  studentName: string;
  className: string | null;
  inputYmd: string;
  prestasiYmd: string | null;
  label: string;
  percent: number | null;
  basis: number;
  effectiveBefore: number | null;
  pointsDelta: number;
  effectiveAfter: number | null;
  note: string | null;
  createdByName: string | null;
};

function monthRange() {
  const today = calendarTodayYmd();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export default function RemisiManualClient({ canManage, classes }: { canManage: boolean; classes: ClassOpt[] }) {
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [classId, setClassId] = useState("");
  const [jenis, setJenis] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [jenisOptions, setJenisOptions] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ jumlah: 0, totalPoin: 0, jenisTerbanyak: null as string | null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ type: "manual", from, to, page: String(page), pageSize: "20" });
      if (classId) sp.set("classId", classId);
      if (jenis) sp.set("jenis", jenis);
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/remisi?${sp}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal memuat riwayat");
      setRows(data.rows ?? []);
      setTotalPages(data.totalPages ?? 1);
      setJenisOptions(data.jenisOptions ?? []);
      setSummary({
        jumlah: data.summary?.jumlah ?? 0,
        totalPoin: data.summary?.totalPoin ?? 0,
        jenisTerbanyak: data.summary?.jenisTerbanyak ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, [from, to, classId, jenis, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeRow(row: Row) {
    const cut = Math.abs(row.pointsDelta);
    const ok = window.confirm(
      `Hapus remisi manual "${row.label}" untuk ${row.studentName}?\n\nPotongan ${cut} poin dikembalikan. Remisi otomatis yang jatuh tempo setelah tanggal input ini dihitung ulang, supaya poin sama seperti remisi ini tidak pernah dimasukkan.`
    );
    if (!ok) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/admin/manual-remisi/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus remisi");
      const restored = typeof data.pointsRestored === "number" ? data.pointsRestored : cut;
      const after = typeof data.effectiveAfter === "number" ? data.effectiveAfter : null;
      let text = `Remisi manual dihapus. ${restored} poin dari baris itu kembali ke ${row.studentName}.`;
      if (data.autoRebuilt > 0) {
        text += ` Remisi otomatis setelah tanggal input itu dihitung ulang.`;
      }
      if (after != null) text += ` Poin efektif sekarang ${after}.`;
      toast.success(text);
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus remisi");
    } finally {
      setDeletingId(null);
    }
  }

  function exportHref() {
    const sp = new URLSearchParams({ type: "manual", from, to });
    if (classId) sp.set("classId", classId);
    if (jenis) sp.set("jenis", jenis);
    if (q.trim()) sp.set("q", q.trim());
    return `/api/remisi/export?${sp}`;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Riwayat Remisi Manual</h1>
          <p className="page-subtitle">Remisi dan reward yang diinput staf, terpisah dari remisi otomatis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref()} className="btn btn-secondary btn-sm">Ekspor Excel</a>
          {canManage ? (
            <Link href="/remisi/input" className="btn btn-primary btn-sm">+ Input Remisi Manual</Link>
          ) : null}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Jumlah remisi manual" value={String(summary.jumlah)} />
        <Stat label="Total poin" value={String(summary.totalPoin)} />
        <Stat label="Jenis terbanyak" value={summary.jenisTerbanyak ?? "—"} />
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
          Jenis
          <select className="select mt-1" value={jenis} onChange={(e) => { setPage(1); setJenis(e.target.value); }}>
            <option value="">Semua jenis</option>
            {jenisOptions.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Cari nama
          <input className="input mt-1" value={q} placeholder="Nama siswa" onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-elegant min-w-[1080px]">
            <thead>
              <tr>
                {[
                  "Tanggal input",
                  "Tgl prestasi",
                  "Siswa",
                  "Kelas",
                  "Jenis",
                  "%",
                  "Basis",
                  "Poin",
                  "Potongan",
                  "Catatan",
                  "Diinput oleh",
                  ...(canManage ? ["Aksi"] : []),
                ].map((h) => (
                  <th key={h} className="px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 12 : 11} className="px-3 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    {loading ? "Memuat..." : "Tidak ada remisi manual pada rentang ini."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 text-sm">{formatYmdIndonesia(r.inputYmd)}</td>
                    <td className="px-3 text-sm">{r.prestasiYmd ? formatYmdIndonesia(r.prestasiYmd) : "—"}</td>
                    <td className="px-3 text-sm">
                      <Link href={`/students/${r.studentId}/poin`} className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                        {r.studentName}
                      </Link>
                    </td>
                    <td className="px-3 text-sm">{r.className ?? "—"}</td>
                    <td className="px-3 text-sm">{r.label}</td>
                    <td className="px-3 text-sm tabular-nums">{r.percent == null ? "—" : `${r.percent}%`}</td>
                    <td className="px-3 text-sm tabular-nums">{r.basis}</td>
                    <td className="px-3 text-sm tabular-nums">
                      {r.effectiveBefore == null ? "—" : `${r.effectiveBefore} → ${r.effectiveAfter}`}
                    </td>
                    <td className="px-3 text-sm tabular-nums">{r.pointsDelta}</td>
                    <td className="px-3 text-sm">{r.note || "—"}</td>
                    <td className="px-3 text-sm">{r.createdByName || "—"}</td>
                    {canManage ? (
                      <td className="px-3 text-sm">
                        <button
                          type="button"
                          className="btn btn-danger touch-manipulation text-[11px] btn-sm"
                          disabled={deletingId === r.id}
                          onClick={() => void removeRow(r)}
                        >
                          {deletingId === r.id ? "Menghapus…" : "Hapus"}
                        </button>
                      </td>
                    ) : null}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-1 font-serif text-2xl font-semibold">{value}</div>
    </div>
  );
}
