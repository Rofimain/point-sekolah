"use client";
import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { formatDate } from "@/lib/utils";
import type { RecordsRow } from "./records-view";
import { AddRecordStudentPicker, type PickerStudent } from "./AddRecordStudentPicker";

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
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || "");
  const [exporting, setExporting] = useState(false);

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
    setLoading(true);
    await fetch(`/api/records/${editModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: editPoints, notes: editNotes, violationTypeId: editVtId }),
    });
    setLoading(false); setEditModal(null); router.refresh();
  }

  async function handleAdd() {
    if (!addStudentId || !addVtId) return;
    setLoading(true);
    const vt = violationTypes.find((v: any) => v.id === addVtId);
    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: addStudentId, violationTypeId: addVtId, session: addSession, notes: addNotes, points: vt?.points }),
    });
    setLoading(false); setAddModal(false); setAddStudentId(""); setAddVtId(""); setAddSession(""); setAddNotes(""); router.refresh();
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

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Catatan Pelanggaran Siswa</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {rosterMode
              ? `${total} siswa sesuai filter — tiap halaman ${perPage} siswa (catatan terbaru, maks. 40 per siswa)`
              : `${total} catatan ditemukan — urut input terbaru`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setAddStudentId("");
              setAddVtId("");
              setAddNotes("");
              setAddSession("");
              setAddModal(true);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            + Tambah Catatan
          </button>
          <button onClick={handleExport} disabled={exporting} className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-60" style={{ background: "var(--success-bg)", color: "var(--success)", borderColor: "var(--success)" }}>
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
        <div className="overflow-x-auto">
          <table className="w-full">
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
                          <button
                            type="button"
                            onClick={() => {
                              setAddStudentId(s.id);
                              setAddVtId("");
                              setAddNotes("");
                              setAddSession("");
                              setAddModal(true);
                            }}
                            className="px-2.5 py-1 rounded border text-[11px]"
                            style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
                          >
                            + Catatan
                          </button>
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
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditModal(r);
                              setEditPoints(r.points);
                              setEditNotes(r.notes || "");
                              setEditVtId(r.violationTypeId);
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
          <div className="px-4 py-3 border-t flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Halaman {page} dari {totalPages}</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(p)); router.push(`${pathname}?${sp.toString()}`); }} className="w-7 h-7 rounded text-xs" style={{ background: p === page ? "var(--accent)" : "var(--bg-primary)", color: p === page ? "white" : "var(--text-secondary)", border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}` }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setEditModal(null)}>
          <div className="rounded-xl border p-6 w-full max-w-md mx-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
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
          className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => {
            setAddModal(false);
          }}
        >
          <div
            className="rounded-2xl border p-6 w-full max-w-lg shadow-2xl my-6"
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
