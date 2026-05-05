"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { QrisStyleSuccessSheet, type QrisSuccessDetail } from "@/components/QrisStyleSuccessSheet";
import { formatDate } from "@/lib/utils";
import type { RecordsRow } from "./records-view";
import { AddRecordStudentPicker, type PickerStudent } from "./AddRecordStudentPicker";
import { violationNeedsEvidence, heavyViolationPointsThreshold } from "@/lib/heavy-violation";

const SESSION_SLOTS = ["Jam 1-2", "Jam 3-4", "Jam 5-6", "Jam 7-8", "Istirahat / Umum"];

function PointBadge({ points }: { points: number }) {
  const c = points >= 75 ? ["var(--danger-bg)","var(--danger)"] : points >= 50 ? ["var(--warning-bg)","var(--warning)"] : ["var(--success-bg)","var(--success)"];
  return <span className="inline-flex items-center justify-center w-9 h-5 rounded-full text-xs font-bold" style={{ background: c[0], color: c[1] }}>{points}</span>;
}

function StatusBadge({ points }: { points: number }) {
  const s = points >= 75 ? ["var(--danger-bg)","var(--danger)","Kritis"] : points >= 50 ? ["var(--warning-bg)","var(--warning)","Perhatian"] : ["var(--success-bg)","var(--success)","Normal"];
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: s[0], color: s[1] }}>{s[2]}</span>;
}

export default function RecordsClient({
  rows,
  total,
  page,
  perPage,
  classes,
  violationTypes,
  studentsForPicker,
  totalPointsMap,
  searchParams,
  rosterMode,
}: {
  rows: RecordsRow[];
  total: number;
  page: number;
  perPage: number;
  classes: { id: string; name: string; grade: string }[];
  violationTypes: any[];
  studentsForPicker: PickerStudent[];
  totalPointsMap: Record<string, number>;
  searchParams: { grade?: string; classId?: string; search?: string; page?: string };
  rosterMode: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / perPage);

  const classesFiltered = useMemo(() => {
    if (!searchParams.grade) return classes;
    return classes.filter((c) => c.grade === searchParams.grade);
  }, [classes, searchParams.grade]);

  const [editModal, setEditModal] = useState<any>(null);
  const [editPoints, setEditPoints] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editVtId, setEditVtId] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addVtId, setAddVtId] = useState("");
  const [addSession, setAddSession] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addEvidenceDataUrl, setAddEvidenceDataUrl] = useState("");
  const [addSignatureText, setAddSignatureText] = useState("");
  const [editEvidenceDataUrl, setEditEvidenceDataUrl] = useState("");
  const [editSignatureText, setEditSignatureText] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || "");
  const [exporting, setExporting] = useState(false);
  const [successSheet, setSuccessSheet] = useState<{
    title: string;
    subtitle: string;
    details: QrisSuccessDetail[];
  } | null>(null);

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus catatan ini?")) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleEdit() {
    if (!editModal) return;
    setLoading(true);
    const body: Record<string, unknown> = { points: editPoints, notes: editNotes, violationTypeId: editVtId };
    if (editEvidenceDataUrl.trim()) body.evidenceImageData = editEvidenceDataUrl.trim();
    if (editSignatureText.trim()) body.studentSignatureData = editSignatureText.trim();
    const res = await fetch(`/api/records/${editModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Gagal menyimpan");
      return;
    }
    const vt = violationTypes.find((v: any) => v.id === editVtId);
    const when = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    setSuccessSheet({
      title: "Berhasil",
      subtitle: "Perubahan catatan pelanggaran telah disimpan.",
      details: [
        { label: "Siswa", value: editModal.student?.name ?? "—" },
        { label: "Pelanggaran", value: vt?.name ?? "—" },
        { label: "Poin", value: `${editPoints} poin` },
        { label: "Waktu", value: when },
      ],
    });
    setEditModal(null);
    setEditEvidenceDataUrl("");
    setEditSignatureText("");
    router.refresh();
  }

  async function handleAdd() {
    if (!addStudentId || !addVtId) return;
    const vt = violationTypes.find((v: any) => v.id === addVtId);
    const pts = vt?.points ?? 0;
    if (violationNeedsEvidence(pts) && !addEvidenceDataUrl.trim() && addSignatureText.trim().length < 12) {
      toast.error(`Di atas ${heavyViolationPointsThreshold()} poin wajib foto bukti dan/atau pengakuan murid (≥12 karakter).`);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: addStudentId,
        violationTypeId: addVtId,
        session: addSession,
        notes: addNotes,
        points: vt?.points,
        evidenceImageData: addEvidenceDataUrl.trim() || undefined,
        studentSignatureData: addSignatureText.trim() || undefined,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Gagal menyimpan");
      return;
    }
    const n = data.parentTelegramNotify as
      | { status: "sent" }
      | { status: "skipped_no_recipient" }
      | { status: "skipped_no_token" }
      | { status: "failed"; message: string }
      | undefined;
    if (n?.status === "failed") {
      toast.error(`Notifikasi Telegram ortu gagal: ${n.message}`);
    } else if (n?.status === "skipped_no_token") {
      toast.warning("Catatan tersimpan; notifikasi ortu tidak dikirim — atur TELEGRAM_BOT_TOKEN di server.");
    } else if (n?.status === "skipped_no_recipient") {
      toast.info("Catatan tersimpan; siswa ini belum punya Telegram orang tua di data.");
    }
    const st = studentsForPicker.find((s) => s.id === addStudentId);
    const when = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    const detailRows: QrisSuccessDetail[] = [
      { label: "Siswa", value: st?.name ?? "—" },
      { label: "Pelanggaran", value: vt?.name ?? "—" },
      { label: "Poin", value: `${pts} poin` },
    ];
    if (addSession.trim()) detailRows.push({ label: "Sesi", value: addSession.trim() });
    detailRows.push({ label: "Waktu", value: when });
    setSuccessSheet({
      title: "Berhasil",
      subtitle: "Catatan pelanggaran sudah masuk ke sistem.",
      details: detailRows,
    });
    setAddModal(false);
    setAddStudentId("");
    setAddVtId("");
    setAddSession("");
    setAddNotes("");
    setAddEvidenceDataUrl("");
    setAddSignatureText("");
    router.refresh();
  }

  function onAddEvidenceFile(file: File | null) {
    setAddEvidenceDataUrl("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Gunakan file gambar.");
      return;
    }
    if (file.size > 400 * 1024) {
      toast.error("Foto terlalu besar (maks. ~400 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAddEvidenceDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function onEditEvidenceFile(file: File | null) {
    setEditEvidenceDataUrl("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Gunakan file gambar.");
      return;
    }
    if (file.size > 400 * 1024) {
      toast.error("Foto terlalu besar (maks. ~400 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditEvidenceDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function handleExport() {
    setExporting(true);
    const sp = new URLSearchParams(searchParams);
    const res = await fetch(`/api/export?${sp.toString()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `catatan-pelanggaran-${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
    setExporting(false);
  }

  const grades = ["X", "XI", "XII"];

  const addResolvedPts = violationTypes.find((v: any) => v.id === addVtId)?.points ?? 0;
  const addNeedEvidence = violationNeedsEvidence(addResolvedPts);
  const editNeedEvidence = editModal ? violationNeedsEvidence(editPoints) : false;
  const heavyTh = heavyViolationPointsThreshold();

  return (
    <div>
      {successSheet && (
        <QrisStyleSuccessSheet
          open
          onClose={() => setSuccessSheet(null)}
          title={successSheet.title}
          subtitle={successSheet.subtitle}
          details={successSheet.details}
        />
      )}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Catatan Pelanggaran Siswa</h1>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {rosterMode
              ? `${total} siswa sesuai filter — tiap halaman ${perPage} siswa (catatan terbaru, maks. 40 per siswa)`
              : `${total} catatan ditemukan — urut input terbaru`}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setAddStudentId("");
              setAddVtId("");
              setAddNotes("");
              setAddSession("");
              setAddEvidenceDataUrl("");
              setAddSignatureText("");
              setAddModal(true);
            }}
            className="w-full touch-manipulation rounded-lg px-3 py-2.5 text-xs font-semibold text-white sm:w-auto sm:py-1.5"
            style={{ background: "var(--accent)" }}
          >
            + Tambah Catatan
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="w-full touch-manipulation rounded-lg border px-3 py-2.5 text-xs font-semibold disabled:opacity-60 sm:w-auto sm:py-1.5"
            style={{ background: "var(--success-bg)", color: "var(--success)", borderColor: "var(--success)" }}
          >
            {exporting ? "Mengekspor..." : "↓ Export Excel"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-3 mb-4 flex flex-wrap gap-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && navigate({ search })} placeholder="Cari nama siswa... (Enter)" className="px-3 py-2 rounded-lg border text-xs flex-1 min-w-40" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        <select
          value={searchParams.grade || ""}
          onChange={(e) => navigate({ grade: e.target.value, classId: "" })}
          className="px-3 py-2 rounded-lg border text-xs"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <option value="">Semua Angkatan</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              Angkatan {g}
            </option>
          ))}
        </select>
        <select
          value={searchParams.classId || ""}
          onChange={(e) => navigate({ classId: e.target.value })}
          className="px-3 py-2 rounded-lg border text-xs"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <option value="">{searchParams.grade ? "Semua kelas di angkatan ini" : "Semua Kelas"}</option>
          {classesFiltered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(searchParams.grade || searchParams.classId || searchParams.search) && (
          <button onClick={() => { setSearch(""); router.push(pathname); }} className="px-3 py-2 rounded-lg border text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Reset</button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[720px]">
            <thead><tr style={{ background: "var(--bg-primary)" }}>
              {["Nama Siswa","Kelas","Pelanggaran","Tanggal","Poin","Total Poin","Status","Aksi"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Tidak ada data
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  if (row.type === "placeholder") {
                    const s = row.student;
                    const totalPts = totalPointsMap[s.id] || 0;
                    return (
                      <tr key={`ph-${s.id}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-3 text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {s.class?.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs italic" style={{ color: "var(--text-muted)" }}>
                          Belum ada catatan
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          —
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            —
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <PointBadge points={totalPts} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge points={totalPts} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/students/${s.id}/cetak`}
                              className="px-2.5 py-1 rounded border text-[11px] font-medium"
                              style={{ borderColor: "var(--border)", color: "var(--accent)", background: "var(--bg-primary)" }}
                            >
                              Cetak poin
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setAddStudentId(s.id);
                                setAddVtId("");
                                setAddNotes("");
                                setAddSession("");
                                setAddEvidenceDataUrl("");
                                setAddSignatureText("");
                                setAddModal(true);
                              }}
                              className="px-2.5 py-1 rounded border text-[11px]"
                              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
                            >
                              + Catatan
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const r = row.record;
                  const totalPts = totalPointsMap[r.studentId] || 0;
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3 text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                        {r.student.name}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {r.student.class?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)", maxWidth: 160 }}>
                        <span className="line-clamp-1">{r.violationType.name}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {formatDate(r.date)}
                      </td>
                      <td className="px-4 py-3">
                        <PointBadge points={r.points} />
                      </td>
                      <td className="px-4 py-3">
                        <PointBadge points={totalPts} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge points={totalPts} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/students/${r.studentId}/cetak`}
                            className="px-2.5 py-1 rounded border text-[11px] font-medium"
                            style={{ borderColor: "var(--border)", color: "var(--accent)", background: "var(--bg-primary)" }}
                          >
                            Cetak poin
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setEditModal(r);
                              setEditPoints(r.points);
                              setEditNotes(r.notes || "");
                              setEditVtId(r.violationTypeId);
                              setEditEvidenceDataUrl("");
                              setEditSignatureText("");
                            }}
                            className="px-2.5 py-1 rounded border text-[11px]"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="px-2.5 py-1 rounded border text-[11px]"
                            style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Halaman {page} dari {totalPages}</span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(p)); router.push(`${pathname}?${sp.toString()}`); }} className="w-7 h-7 rounded text-xs" style={{ background: p === page ? "var(--accent)" : "var(--bg-primary)", color: p === page ? "white" : "var(--text-secondary)", border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}` }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setEditModal(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border px-4 pt-4 pb-sheet-bottom sm:mx-0 sm:rounded-xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-serif mb-4 pb-3 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>Edit Catatan — {editModal.student.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Jenis Pelanggaran</label>
                <select value={editVtId} onChange={(e) => { setEditVtId(e.target.value); const vt = violationTypes.find((v: any) => v.id === e.target.value); if (vt) setEditPoints(vt.points); }} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {violationTypes.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Poin</label>
                <input type="number" value={editPoints} onChange={(e) => setEditPoints(parseInt(e.target.value))} min={0} max={100} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Keterangan</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              {editNeedEvidence && (
                <div className="rounded-lg border p-3 space-y-2" style={{ background: "var(--bg-primary)", borderColor: "var(--accent-border)" }}>
                  <p className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>
                    Bukti untuk poin di atas {heavyTh} (isi jika belum ada atau perlu diperbarui)
                  </p>
                  <input type="file" accept="image/*" className="w-full text-xs" onChange={(e) => onEditEvidenceFile(e.target.files?.[0] ?? null)} />
                  <textarea
                    value={editSignatureText}
                    onChange={(e) => setEditSignatureText(e.target.value)}
                    rows={2}
                    placeholder="Pengakuan / nama lengkap murid (min. 12 karakter)"
                    className="w-full px-3 py-2 rounded-lg border text-xs resize-none"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Batal</button>
              <button onClick={handleEdit} disabled={loading} className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => {
            setAddModal(false);
          }}
        >
          <div
            className="my-0 max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border px-4 pt-4 pb-sheet-bottom shadow-2xl sm:my-6 sm:rounded-2xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                +
              </div>
              <div>
                <h3 className="text-base font-serif leading-tight" style={{ color: "var(--text-primary)" }}>
                  Tambah catatan pelanggaran
                </h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Pilih siswa dari daftar, lalu jenis pelanggaran. Total poin per siswa tampil sebagai panduan.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <AddRecordStudentPicker
                students={studentsForPicker}
                value={addStudentId}
                onChange={setAddStudentId}
                totalPointsMap={totalPointsMap}
              />

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Jenis pelanggaran
                </label>
                <select
                  value={addVtId}
                  onChange={(e) => setAddVtId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">— Pilih jenis —</option>
                  {violationTypes.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.points} poin)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Sesi / waktu <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opsional)</span>
                </label>
                <select
                  value={addSession}
                  onChange={(e) => setAddSession(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">— Tidak spesifik —</option>
                  {SESSION_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Keterangan <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opsional)</span>
                </label>
                <textarea
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  rows={2}
                  placeholder="Detail kejadian, lokasi, dll."
                  className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              {addNeedEvidence && (
                <div className="rounded-xl border p-3 space-y-3" style={{ background: "var(--bg-primary)", borderColor: "var(--accent-border)" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                    Bukti tambahan (wajib): pelanggaran di atas {heavyTh} poin
                  </p>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Foto bukti
                    </label>
                    <input type="file" accept="image/*" className="w-full text-xs" onChange={(e) => onAddEvidenceFile(e.target.files?.[0] ?? null)} />
                    {addEvidenceDataUrl ? (
                      <span className="text-[10px]" style={{ color: "var(--success)" }}>
                        Foto terpasang
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Pengakuan / tanda tangan (teks, min. 12 karakter)
                    </label>
                    <textarea
                      value={addSignatureText}
                      onChange={(e) => setAddSignatureText(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border text-xs resize-none"
                      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      placeholder="Nama lengkap & pengakuan"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => setAddModal(false)}
                className="px-4 py-2.5 rounded-xl border text-sm font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={loading || !addStudentId || !addVtId}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--accent)" }}
              >
                {loading ? "Menyimpan…" : "Simpan catatan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
