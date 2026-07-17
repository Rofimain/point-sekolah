"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { QrisStyleSuccessSheet, type QrisSuccessDetail } from "@/components/QrisStyleSuccessSheet";
import { formatDate, formatIncidentDateOnly, formatInputDateTime } from "@/lib/utils";
import { ViolationTypePicker } from "@/components/ViolationTypePicker";
import type { RecordsRow, ViolationRecordListItem } from "./records-view";
import { AddRecordStudentPicker, type PickerStudent } from "./AddRecordStudentPicker";
import { violationNeedsEvidence, heavyViolationPointsThreshold } from "@/lib/heavy-violation";
import { calendarTodayYmd, dateToYmdInput } from "@/lib/incident-date";
import { EvidencePreviewModal } from "@/components/records/EvidencePreviewModal";
import { EvidenceMultiUploader } from "@/components/records/EvidenceMultiUploader";

const SESSION_SLOTS = ["Jam 1-2", "Jam 3-4", "Jam 5-6", "Jam 7-8", "Istirahat / Umum"];

function PointBadge({ points }: { points: number }) {
  const c = points >= 75 ? ["var(--danger-bg)","var(--danger)"] : points >= 50 ? ["var(--warning-bg)","var(--warning)"] : ["var(--success-bg)","var(--success)"];
  return <span className="badge-soft" style={{ background: c[0], color: c[1], borderColor: "color-mix(in srgb, currentColor 18%, transparent)" }}>{points}</span>;
}

function StatusBadge({ points }: { points: number }) {
  const s = points >= 75 ? ["var(--danger-bg)","var(--danger)","Kritis"] : points >= 50 ? ["var(--warning-bg)","var(--warning)","Perhatian"] : ["var(--success-bg)","var(--success)","Normal"];
  return <span className="badge-soft px-2.5" style={{ background: s[0], color: s[1], borderColor: "color-mix(in srgb, currentColor 18%, transparent)" }}>{s[2]}</span>;
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
  canManage,
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
  canManage: boolean;
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
  const [addEvidenceImages, setAddEvidenceImages] = useState<string[]>([]);
  const [addSignatureText, setAddSignatureText] = useState("");
  const [editEvidenceImages, setEditEvidenceImages] = useState<string[]>([]);
  const [editSignatureText, setEditSignatureText] = useState("");
  const [addIncidentDate, setAddIncidentDate] = useState(() => calendarTodayYmd());
  const [editIncidentDate, setEditIncidentDate] = useState("");
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || "");
  const [exporting, setExporting] = useState(false);
  const [successSheet, setSuccessSheet] = useState<{
    title: string;
    subtitle: string;
    details: QrisSuccessDetail[];
    receiptRecordId?: string;
  } | null>(null);

  useEffect(() => {
    setSearch(searchParams.search || "");
  }, [searchParams.search]);

  const selectedClass = searchParams.classId
    ? classes.find((c) => c.id === searchParams.classId) ?? null
    : null;

  function openReceiptSheetForRecord(r: ViolationRecordListItem) {
    const details: QrisSuccessDetail[] = [
      { label: "Siswa", value: r.student?.name ?? "—" },
      ...(r.student?.class?.name ? [{ label: "Kelas", value: r.student.class.name }] : []),
      { label: "Pelanggaran", value: r.violationType?.name ?? "—" },
      { label: "Poin", value: `${r.points} poin` },
    ];
    if (r.session?.trim()) details.push({ label: "Sesi", value: r.session.trim() });
    details.push(
      { label: "Tanggal pelanggaran", value: formatIncidentDateOnly(r.date) },
      { label: "Waktu penginputan", value: formatInputDateTime(r.createdAt) }
    );
    if (r.createdByName?.trim()) details.push({ label: "Diinput oleh", value: r.createdByName.trim() });
    if (r.notes?.trim()) details.push({ label: "Keterangan", value: r.notes.trim() });

    setSuccessSheet({
      title: "Bukti pelanggaran",
      subtitle: "Catatan ini sudah tersimpan di sistem dan dapat digunakan sebagai bukti.",
      details,
      receiptRecordId: r.id,
    });
  }

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  }

  useEffect(() => {
    if (!editModal) {
      setEditEvidenceImages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/records/${editModal.id}`, { cache: "no-store", credentials: "same-origin" });
        const d = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const images =
          Array.isArray(d.evidenceImages) && d.evidenceImages.length > 0
            ? d.evidenceImages.filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
            : typeof d.evidenceImageData === "string" && d.evidenceImageData.trim()
              ? [d.evidenceImageData.trim()]
              : [];
        setEditEvidenceImages(images);
        setEditSignatureText(typeof d.studentSignatureData === "string" ? d.studentSignatureData : "");
      } catch {
        if (!cancelled) {
          setEditEvidenceImages([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editModal]);

  async function handleDelete(id: string) {
    if (!confirm("Hapus catatan ini?")) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleEdit() {
    if (!editModal) return;
    if (!editIncidentDate.trim()) {
      toast.error("Tanggal kejadian wajib diisi.");
      return;
    }
    setLoading(true);
    const body: Record<string, unknown> = {
      points: editPoints,
      notes: editNotes,
      violationTypeId: editVtId,
      date: editIncidentDate,
      evidenceImages: editEvidenceImages,
    };
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
    const updated = await res.json();
    const vt = violationTypes.find((v: any) => v.id === editVtId);
    setSuccessSheet({
      title: "Berhasil",
      subtitle: "Perubahan catatan pelanggaran telah disimpan.",
      details: [
        { label: "Siswa", value: editModal.student?.name ?? "—" },
        { label: "Pelanggaran", value: vt?.name ?? "—" },
        { label: "Poin", value: `${editPoints} poin` },
        { label: "Tanggal pelanggaran", value: formatIncidentDateOnly(updated.date) },
        { label: "Waktu penginputan", value: formatInputDateTime(updated.updatedAt) },
      ],
      receiptRecordId: editModal.id,
    });
    setEditModal(null);
    setEditEvidenceImages([]);
    setEditSignatureText("");
    router.refresh();
  }

  async function handleAdd() {
    if (!addStudentId || !addVtId) return;
    if (!addIncidentDate.trim()) {
      toast.error("Tanggal kejadian wajib diisi.");
      return;
    }
    const vt = violationTypes.find((v: any) => v.id === addVtId);
    const pts = vt?.points ?? 0;
    if (violationNeedsEvidence(pts) && addEvidenceImages.length === 0 && addSignatureText.trim().length < 12) {
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
        date: addIncidentDate,
        evidenceImages: addEvidenceImages.length > 0 ? addEvidenceImages : undefined,
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
    }
    const st = studentsForPicker.find((s) => s.id === addStudentId);
    const detailRows: QrisSuccessDetail[] = [
      { label: "Siswa", value: st?.name ?? "—" },
      { label: "Pelanggaran", value: vt?.name ?? "—" },
      { label: "Poin", value: `${pts} poin` },
    ];
    if (addSession.trim()) detailRows.push({ label: "Sesi", value: addSession.trim() });
    detailRows.push(
      { label: "Tanggal pelanggaran", value: formatIncidentDateOnly(data.date) },
      { label: "Waktu penginputan", value: formatInputDateTime(data.createdAt) }
    );
    setSuccessSheet({
      title: "Berhasil",
      subtitle: "Catatan pelanggaran sudah masuk ke sistem.",
      details: detailRows,
      receiptRecordId: data.id,
    });
    setAddModal(false);
    setAddStudentId("");
    setAddVtId("");
    setAddSession("");
    setAddNotes("");
    setAddEvidenceImages([]);
    setAddSignatureText("");
    setAddIncidentDate(calendarTodayYmd());
    router.refresh();
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
      {previewRecordId && (
        <EvidencePreviewModal recordId={previewRecordId} onClose={() => setPreviewRecordId(null)} />
      )}
      {successSheet && (
        <QrisStyleSuccessSheet
          open
          onClose={() => setSuccessSheet(null)}
          title={successSheet.title}
          subtitle={successSheet.subtitle}
          details={successSheet.details}
          receiptRecordId={successSheet.receiptRecordId}
        />
      )}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--gold)" }}>
            Administrasi
          </p>
          {selectedClass ? (
            <>
              <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Navigasi kelas">
                <Link href="/records" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                  Semua kelas
                </Link>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <span style={{ color: "var(--text-secondary)" }}>{selectedClass.name}</span>
              </nav>
              <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
                Catatan · {selectedClass.name}
              </h1>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {rosterMode
                  ? `${total} siswa di kelas ini — tiap halaman ${perPage} siswa`
                  : `${total} catatan di kelas ini`}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
                Catatan Pelanggaran Siswa
              </h1>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {rosterMode
                  ? `${total} siswa sesuai kategori — tiap halaman ${perPage} siswa (catatan terbaru, maks. 40 per siswa)`
                  : `${total} catatan ditemukan — urut input terbaru. Pilih kelas di menu samping untuk fokus satu kelas.`}
              </p>
            </>
          )}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setAddStudentId("");
              setAddVtId("");
              setAddNotes("");
              setAddSession("");
              setAddEvidenceImages([]);
              setAddSignatureText("");
              setAddIncidentDate(calendarTodayYmd());
              setAddModal(true);
            }}
            className="btn-primary w-full touch-manipulation px-4 py-2.5 text-xs sm:w-auto sm:py-2"
          >
            + Tambah Catatan
          </button>
          {canManage && <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="w-full touch-manipulation rounded-lg border px-4 py-2.5 text-xs font-semibold disabled:opacity-60 sm:w-auto sm:py-2"
            style={{ background: "var(--success-bg)", color: "var(--success)", borderColor: "var(--success)" }}
          >
            {exporting ? "Mengekspor..." : "Export Excel"}
          </button>}
        </div>
      </div>

      {/* Filters */}
      <div className="panel mb-4 flex flex-wrap gap-2 p-3.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate({ search: search.trim() })}
          placeholder="Cari nama siswa..."
          list="record-student-suggestions"
          autoComplete="off"
          className="px-3 py-2 rounded-lg border text-xs flex-1 min-w-40"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <datalist id="record-student-suggestions">
          {studentsForPicker.map((student) => (
            <option key={student.id} value={student.name}>
              {[student.class?.name, student.nisn].filter(Boolean).join(" · ")}
            </option>
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => navigate({ search: search.trim() })}
          className="btn-primary px-4 py-2 text-xs"
        >
          Cari
        </button>
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

      <div className="panel-flush">
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[800px]">
            <thead><tr style={{ background: "color-mix(in srgb, var(--bg-primary) 75%, var(--accent-light))" }}>
              {["Nama Siswa","Kelas","Pelanggaran","Tanggal","Poin","Total Poin","Status","Bukti","Aksi"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
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
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          —
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1 rounded border text-[11px] font-medium opacity-60 cursor-not-allowed"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-primary)" }}
                          >
                            Bukti
                          </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddStudentId(s.id);
                                setAddVtId("");
                                setAddNotes("");
                                setAddSession("");
                                setAddEvidenceImages([]);
                                setAddSignatureText("");
                                setAddIncidentDate(calendarTodayYmd());
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.evidenceImagePresent ? (
                          <button
                            type="button"
                            onClick={() => setPreviewRecordId(r.id)}
                            className="text-[11px] font-semibold underline-offset-2 hover:underline"
                            style={{ color: "var(--accent)" }}
                          >
                            Lihat foto
                          </button>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => openReceiptSheetForRecord(r)}
                            className="px-2.5 py-1 rounded border text-[11px] font-medium"
                            style={{ borderColor: "var(--border)", color: "var(--accent)", background: "var(--bg-primary)" }}
                          >
                            Bukti
                          </button>
                          {canManage && <button
                            type="button"
                            onClick={() => {
                              setEditModal(r);
                              setEditPoints(r.points);
                              setEditNotes(r.notes || "");
                              setEditVtId(r.violationTypeId);
                              setEditIncidentDate(dateToYmdInput(r.date));
                              setEditEvidenceImages([]);
                            }}
                            className="px-2.5 py-1 rounded border text-[11px]"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                          >
                            Edit
                          </button>}
                          {canManage && <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="px-2.5 py-1 rounded border text-[11px]"
                            style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
                          >
                            Hapus
                          </button>}
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
      {canManage && editModal && (
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
                <ViolationTypePicker
                  violationTypes={violationTypes}
                  value={editVtId}
                  onChange={(id) => {
                    setEditVtId(id);
                    const vt = violationTypes.find((v: any) => v.id === id);
                    if (vt) setEditPoints(vt.points);
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Poin</label>
                <input type="number" value={editPoints} onChange={(e) => setEditPoints(parseInt(e.target.value))} min={0} max={200} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Tanggal kejadian</label>
                <input
                  type="date"
                  required
                  value={editIncidentDate}
                  onChange={(e) => setEditIncidentDate(e.target.value)}
                  min="2015-01-01"
                  max={calendarTodayYmd()}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Tanggal kejadian (bukan tanggal input); dipakai hitung remisi.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Keterangan</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div className="rounded-lg border p-3 space-y-3" style={{ background: "var(--bg-primary)", borderColor: editNeedEvidence ? "var(--accent-border)" : "var(--border)" }}>
                {editNeedEvidence ? (
                  <p className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>
                    Bukti (poin di atas {heavyTh}): foto dan/atau pengakuan teks
                  </p>
                ) : null}
                <EvidenceMultiUploader
                  images={editEvidenceImages}
                  onChange={setEditEvidenceImages}
                  disabled={loading}
                />
                <div>
                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Pengakuan / tanda tangan (teks)
                  </label>
                  <textarea
                    value={editSignatureText}
                    onChange={(e) => setEditSignatureText(e.target.value)}
                    rows={2}
                    placeholder="Pengakuan / nama lengkap murid (min. 12 karakter)"
                    className="w-full px-3 py-2 rounded-lg border text-xs resize-none"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
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
                <ViolationTypePicker
                  label="Jenis pelanggaran"
                  violationTypes={violationTypes}
                  value={addVtId}
                  onChange={setAddVtId}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Tanggal kejadian
                </label>
                <input
                  type="date"
                  value={addIncidentDate}
                  onChange={(e) => setAddIncidentDate(e.target.value)}
                  min="2015-01-01"
                  max={calendarTodayYmd()}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Sesuai hari kejadian asli (bukan hari input). Remisi dihitung dari tanggal ini; maks. hari ini (WIB).
                </p>
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

              <div className="rounded-xl border p-3 space-y-3" style={{ background: "var(--bg-primary)", borderColor: addNeedEvidence ? "var(--accent-border)" : "var(--border)" }}>
                  {addNeedEvidence ? (
                    <p className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                      Bukti tambahan (wajib): pelanggaran di atas {heavyTh} poin
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Foto bukti (opsional)
                    </p>
                  )}
                  <EvidenceMultiUploader
                    images={addEvidenceImages}
                    onChange={setAddEvidenceImages}
                    disabled={loading}
                  />
                  {addNeedEvidence ? (
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
                  ) : null}
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
