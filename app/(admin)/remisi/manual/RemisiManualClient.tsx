"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { PaginationBar } from "@/components/PaginationBar";
import { calendarTodayYmd } from "@/lib/incident-date";
import { formatYmdIndonesia } from "@/lib/point-adjustment-reason";
import { manualRemisiCutFromCurrentPoints, resolveManualRemisiPercent } from "@/lib/remisi-rules";
import { Z_MODAL_CLASS } from "@/lib/ui-layers";

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

type EditForm = {
  id: string;
  studentName: string;
  className: string | null;
  label: string;
  percent: string;
  achievementYmd: string;
  note: string;
  basis: number;
  effectiveYmd: string;
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
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  async function openEdit(row: Row) {
    setEditLoadingId(row.id);
    try {
      const res = await fetch(`/api/admin/manual-remisi/${encodeURIComponent(row.id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal memuat remisi");
      setEdit({
        id: data.id,
        studentName: data.studentName,
        className: data.className ?? null,
        label: data.label ?? row.label,
        percent: data.percent != null ? String(data.percent) : row.percent != null ? String(row.percent) : "",
        achievementYmd: data.achievementYmd || row.prestasiYmd || calendarTodayYmd(),
        note: data.note ?? "",
        basis: typeof data.basis === "number" ? data.basis : row.basis,
        effectiveYmd: data.effectiveYmd || row.inputYmd,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat remisi");
    } finally {
      setEditLoadingId(null);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    const n = Number(edit.percent);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      toast.error("Persentase wajib 1–100.");
      return;
    }
    if (edit.label.trim().length < 2) {
      toast.error("Nama jenis remisi/reward wajib diisi.");
      return;
    }
    if (!edit.achievementYmd) {
      toast.error("Tanggal prestasi wajib diisi.");
      return;
    }
    const cut = manualRemisiCutFromCurrentPoints(edit.basis, Math.round(n));
    const ok = window.confirm(
      `Simpan perubahan remisi "${edit.label.trim()}" untuk ${edit.studentName}?\n\nPotongan dihitung dari poin pada saat remisi ini (${edit.basis}), menjadi ${cut} poin. Pelanggaran dan remisi otomatis sesudah ${formatYmdIndonesia(edit.effectiveYmd)} ikut dihitung ulang.`
    );
    if (!ok) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/manual-remisi/${encodeURIComponent(edit.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customLabel: edit.label.trim(),
          customPercent: n,
          achievementYmd: edit.achievementYmd,
          note: edit.note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengubah remisi");
      let text = `Remisi manual diubah. Potongan sekarang ${Math.abs(data.pointsDelta ?? cut)} poin.`;
      if (data.autoRebuilt > 0) text += " Remisi otomatis sesudahnya dihitung ulang.";
      if (typeof data.effectiveAfter === "number") text += ` Poin efektif sekarang ${data.effectiveAfter}.`;
      toast.success(text);
      setEdit(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah remisi");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeRow(row: Row) {
    const cut = Math.abs(row.pointsDelta);
    const ok = window.confirm(
      `Hapus remisi manual "${row.label}" untuk ${row.studentName}?\n\nPotongan ${cut} poin dikembalikan. Pelanggaran dan remisi otomatis sesudah tanggal input ini ikut dihitung ulang.`
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
          <table className="table-elegant min-w-[1160px]">
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
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn btn-secondary touch-manipulation text-[11px] btn-sm"
                            disabled={editLoadingId === r.id || deletingId === r.id}
                            onClick={() => void openEdit(r)}
                          >
                            {editLoadingId === r.id ? "Memuat…" : "Ubah"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger touch-manipulation text-[11px] btn-sm"
                            disabled={deletingId === r.id || editLoadingId === r.id}
                            onClick={() => void removeRow(r)}
                          >
                            {deletingId === r.id ? "Menghapus…" : "Hapus"}
                          </button>
                        </div>
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
      {edit ? <EditRemisiModal form={edit} saving={savingEdit} onChange={setEdit} onClose={() => setEdit(null)} onSave={() => void saveEdit()} /> : null}
    </div>
  );
}

function EditRemisiModal({
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  form: EditForm;
  saving: boolean;
  onChange: (next: EditForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const resolved = resolveManualRemisiPercent(Number(form.percent));
  const cut = resolved.ok ? manualRemisiCutFromCurrentPoints(form.basis, resolved.percent) : 0;
  if (!mounted) return null;
  return createPortal(
    <div className={`modal-overlay ${Z_MODAL_CLASS} flex items-end justify-center p-0 sm:items-center sm:p-4`} onClick={onClose}>
      <div
        className="modal-surface max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] rounded-b-none px-4 pt-4 pb-sheet-bottom sm:rounded-[1.25rem] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-serif text-sm" style={{ color: "var(--text-primary)" }}>Ubah remisi manual</h3>
        <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
          {form.studentName}
          {form.className ? ` · ${form.className}` : ""} · diinput {formatYmdIndonesia(form.effectiveYmd)}
        </p>
        <div className="space-y-3">
          <label className="label">
            Nama jenis
            <input className="input mt-1" value={form.label} onChange={(e) => onChange({ ...form, label: e.target.value })} />
          </label>
          <label className="label">
            Persentase (%)
            <input
              className="input mt-1 max-w-[8rem]"
              inputMode="numeric"
              value={form.percent}
              onChange={(e) => onChange({ ...form, percent: e.target.value })}
            />
          </label>
          <label className="label">
            Tanggal prestasi
            <input
              className="input mt-1 max-w-xs"
              type="date"
              min="2015-01-01"
              max={calendarTodayYmd()}
              value={form.achievementYmd}
              onChange={(e) => onChange({ ...form, achievementYmd: e.target.value })}
            />
          </label>
          <label className="label">
            Catatan
            <input className="input mt-1" value={form.note} onChange={(e) => onChange({ ...form, note: e.target.value })} />
          </label>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Poin pada saat remisi ini, sebelum pelanggaran dan remisi otomatis sesudahnya:{" "}
            <strong>{form.basis}</strong>. Potongan baru: <strong>{cut || "—"}</strong> poin.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={saving || cut < 1} onClick={onSave}>
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
