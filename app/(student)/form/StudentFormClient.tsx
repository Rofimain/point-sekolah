"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrisStyleSuccessSheet, type QrisSuccessDetail } from "@/components/QrisStyleSuccessSheet";
import { TopBar } from "@/components/layouts/TopBar";
import { formatDate, formatIncidentDateOnly, formatInputDateTime, getInitials, getCategoryLabel } from "@/lib/utils";
import { formatPointAdjustmentReason } from "@/lib/point-adjustment-reason";
import type { Session } from "next-auth";
import { violationNeedsEvidence, heavyViolationPointsThreshold } from "@/lib/heavy-violation";
import { calendarTodayYmd } from "@/lib/incident-date";
import {
  compressImageToDataUrl,
  COMPRESS_TARGET_BYTES_STUDENT,
  isProbablyImageFile,
} from "@/lib/compress-image-client";
import { EvidencePreviewModal } from "@/components/records/EvidencePreviewModal";

const SESSIONS = ["Jam 1-2", "Jam 3-4", "Jam 5-6", "Jam 7-8", "Istirahat / Umum"];
const CRITICAL = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75", 10);
const WARNING = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "50", 10);
const HIGH_ALERT = 25;

function PointBadge({ points }: { points: number }) {
  const color = points >= 25 ? "var(--danger)" : points >= 10 ? "var(--warning)" : "var(--success)";
  const bg = points >= 25 ? "var(--danger-bg)" : points >= 10 ? "var(--warning-bg)" : "var(--success-bg)";
  return (
    <span className="inline-flex items-center justify-center w-9 h-5 rounded-full text-xs font-bold" style={{ background: bg, color }}>
      {points}
    </span>
  );
}

function AdjustmentDelta({ delta }: { delta: number }) {
  const neg = delta < 0;
  return (
    <span
      className="inline-flex min-w-[2.5rem] justify-end tabular-nums text-xs font-bold"
      style={{ color: neg ? "var(--success)" : "var(--danger)" }}
    >
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, [string, string]> = {
    RINGAN: ["var(--success-bg)", "var(--success)"],
    SEDANG: ["var(--warning-bg)", "var(--warning)"],
    BERAT: ["var(--danger-bg)", "var(--danger)"],
  };
  const [bg, color] = map[category] || ["var(--bg-tertiary)", "var(--text-muted)"];
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color }}>
      {getCategoryLabel(category)}
    </span>
  );
}

type Tab = "lapor" | "tata";

export default function StudentFormClient({
  session,
  violationTypes,
  records,
  totalPoints,
  grossPoints = 0,
  adjustmentSum = 0,
  pointAdjustments = [],
  quietDays = 30,
  studentClass,
  studentNisn,
}: {
  session: Session;
  violationTypes: any[];
  records: any[];
  totalPoints: number;
  grossPoints?: number;
  adjustmentSum?: number;
  pointAdjustments?: {
    id: string;
    pointsDelta: number;
    reason: string;
    grossTotalBefore: number;
    createdAt: string | Date;
  }[];
  quietDays?: number;
  studentClass: string | null;
  studentNisn: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("lapor");
  const [vtId, setVtId] = useState("");
  const [sessionSlot, setSessionSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceDataUrl, setEvidenceDataUrl] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [incidentDate, setIncidentDate] = useState(() => calendarTodayYmd());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null);
  const [successSheet, setSuccessSheet] = useState<{
    title: string;
    subtitle: string;
    details: QrisSuccessDetail[];
    receiptRecordId?: string;
  } | null>(null);

  const selectedVt = violationTypes.find((v: any) => v.id === vtId);
  const resolvedPoints = selectedVt?.points ?? 0;
  const needEvidence = violationNeedsEvidence(resolvedPoints);
  const threshold = heavyViolationPointsThreshold();

  const pointStatus = totalPoints >= CRITICAL ? "kritis" : totalPoints >= WARNING ? "perhatian" : "aman";
  const pointColor = pointStatus === "kritis" ? "var(--danger)" : pointStatus === "perhatian" ? "var(--warning)" : "var(--success)";

  const sortedTypes = useMemo(() => {
    return [...violationTypes].sort((a, b) => {
      const catOrder = (c: string) => (c === "RINGAN" ? 0 : c === "SEDANG" ? 1 : 2);
      const ca = catOrder(a.category);
      const cb = catOrder(b.category);
      if (ca !== cb) return ca - cb;
      return a.points - b.points;
    });
  }, [violationTypes]);

  async function onPickEvidenceFile(file: File | null) {
    setEvidenceDataUrl("");
    if (!file) return;
    if (!isProbablyImageFile(file)) {
      toast.error("Gunakan file gambar (JPG, PNG, HEIC, WebP, dll.).");
      return;
    }
    await toast.promise(
      compressImageToDataUrl(file, { maxBytes: COMPRESS_TARGET_BYTES_STUDENT }).then(({ dataUrl, meta }) => {
        setEvidenceDataUrl(dataUrl);
        return meta.outputBytes;
      }),
      {
        loading: "Mengompres foto…",
        success: (bytes) => `Foto siap (~${Math.max(1, Math.round(bytes / 1024))} KB)`,
        error: (err: unknown) => (err instanceof Error ? err.message : "Gagal memproses gambar"),
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vtId) {
      setError("Pilih jenis pelanggaran terlebih dahulu");
      return;
    }
    if (needEvidence && !evidenceDataUrl.trim() && signatureText.trim().length < 12) {
      setError(`Pelanggaran di atas ${threshold} poin wajib foto bukti dan/atau pengakuan tertulis (minimal 12 karakter).`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          violationTypeId: vtId,
          session: sessionSlot,
          notes,
          date: incidentDate,
          evidenceImageData: evidenceDataUrl || undefined,
          studentSignatureData: signatureText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim");
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
      const vtLabel = selectedVt?.name ?? "Pelanggaran";
      const pts = resolvedPoints;
      const incidentRaw = data.date ?? incidentDate;
      const savedRaw = data.createdAt;
      const details: QrisSuccessDetail[] = [
        { label: "Jenis", value: vtLabel },
        { label: "Poin", value: `${pts} poin` },
      ];
      if (sessionSlot.trim()) details.push({ label: "Sesi", value: sessionSlot.trim() });
      details.push(
        { label: "Tanggal pelanggaran", value: formatIncidentDateOnly(incidentRaw) },
        {
          label: "Waktu penginputan",
          value: savedRaw ? formatInputDateTime(savedRaw) : formatInputDateTime(new Date()),
        }
      );
      setSuccessSheet({
        title: "Berhasil",
        subtitle: "Laporan pelanggaran Anda sudah masuk dan tercatat di sistem sekolah.",
        details,
        receiptRecordId: data.id,
      });
      setVtId("");
      setSessionSlot("");
      setNotes("");
      setEvidenceDataUrl("");
      setSignatureText("");
      setIncidentDate(calendarTodayYmd());
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh]" style={{ background: "var(--bg-primary)" }}>
      {previewRecordId ? (
        <EvidencePreviewModal recordId={previewRecordId} onClose={() => setPreviewRecordId(null)} />
      ) : null}
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
      <TopBar />
      <div className="mx-auto max-w-2xl px-3 pt-4 pb-safe-bottom sm:px-5 sm:pt-5">
        <div className="mb-4 flex items-center gap-3 rounded-xl p-3 sm:p-4" style={{ background: "var(--bg-sidebar)" }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-serif text-sm"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            {getInitials(session.user.name || "S")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-serif text-white truncate">{session.user.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              {studentClass || "Kelas tidak ditetapkan"} {studentNisn ? `· NISN: ${studentNisn}` : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Poin efektif
            </div>
            <div className="text-2xl font-serif font-bold" style={{ color: pointColor }}>
              {totalPoints}
            </div>
            <div className="text-[9px] capitalize" style={{ color: pointColor }}>
              {pointStatus}
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTab("lapor")}
            className="w-full touch-manipulation rounded-lg border py-2.5 text-center text-xs font-semibold"
            style={{
              background: tab === "lapor" ? "var(--accent)" : "var(--bg-secondary)",
              color: tab === "lapor" ? "white" : "var(--text-secondary)",
              borderColor: tab === "lapor" ? "var(--accent)" : "var(--border)",
            }}
          >
            Lapor / Riwayat
          </button>
          <button
            type="button"
            onClick={() => setTab("tata")}
            className="w-full touch-manipulation rounded-lg border py-2.5 text-center text-xs font-semibold"
            style={{
              background: tab === "tata" ? "var(--accent)" : "var(--bg-secondary)",
              color: tab === "tata" ? "white" : "var(--text-secondary)",
              borderColor: tab === "tata" ? "var(--accent)" : "var(--border)",
            }}
          >
            Tata tertib
          </button>
        </div>

        {adjustmentSum < 0 && (
          <div
            className="p-3 rounded-lg text-[11px] mb-4 leading-relaxed"
            style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            <strong>Pengurangan periode tenang:</strong> total dari catatan pelanggaran {grossPoints} poin, penyesuaian{" "}
            <strong>{adjustmentSum}</strong> poin (25% dari total saat diterapkan, setelah ≥{quietDays} hari sejak tanggal
            kejadian pelanggaran terakhir). <strong>Poin yang dipakai: {totalPoints}.</strong>
          </div>
        )}

        {totalPoints > HIGH_ALERT && (
          <div
            className="p-3 rounded-lg text-xs mb-4 flex items-start gap-2"
            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
          >
            <span>!</span>
            <span>
              Poin Anda di atas {HIGH_ALERT}. Segera koordinasikan dengan wali kelas atau BP/BK.
            </span>
          </div>
        )}

        {totalPoints >= WARNING && totalPoints <= HIGH_ALERT && (
          <div
            className="p-3 rounded-lg text-xs mb-4 flex items-start gap-2"
            style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
          >
            <span>⚠</span>
            <span>
              Poin Anda <strong>{totalPoints}</strong>. Perhatikan tata tertib agar tidak menumpuk.
            </span>
          </div>
        )}

        {tab === "tata" && (
          <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
                Daftar jenis pelanggaran & poin
              </h2>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Hanya informasi — Anda tetap dapat melihat riwayat pelanggaran sendiri di tab &quot;Lapor&quot;.
              </p>
            </div>
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {sortedTypes.map((v: any) => (
                <li key={v.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {v.name}
                    </div>
                    {v.description && (
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {v.description}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <CategoryBadge category={v.category} />
                    <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {v.points} poin
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "lapor" && (
          <>
            <div
              className="p-3 rounded-lg text-xs mb-5"
              style={{ background: "var(--warning-bg)", color: "var(--warning)", borderLeft: "3px solid var(--warning)" }}
            >
              Pengisian bersifat resmi. Anda atau guru dapat mencatat pelanggaran. Di atas {threshold} poin, lampirkan
              bukti foto dan/atau pengakuan tertulis (nama lengkap).
            </div>

            <div className="mb-5 rounded-xl border p-4 sm:p-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <h2
                className="text-sm font-serif mb-4 pb-3 border-b"
                style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
              >
                Formulir pelaporan — {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Jenis pelanggaran *
                  </label>
                  <select
                    value={vtId}
                    onChange={(e) => setVtId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">— Pilih jenis pelanggaran —</option>
                    {(["RINGAN", "SEDANG", "BERAT"] as const).map((cat) => {
                      const items = violationTypes.filter((v: any) => v.category === cat);
                      if (!items.length) return null;
                      return (
                        <optgroup key={cat} label={`— ${getCategoryLabel(cat)} —`}>
                          {items.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.points} poin)
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {selectedVt && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <CategoryBadge category={selectedVt.category} />
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {selectedVt.points} poin {selectedVt.description ? `· ${selectedVt.description}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Tanggal kejadian *
                  </label>
                  <input
                    type="date"
                    required
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    min="2015-01-01"
                    max={calendarTodayYmd()}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Sesuai hari kejadian asli (bukan hari input). Remisi periode tenang dihitung dari tanggal ini. Jika
                    kejadian hari ini dan langsung dilapor, biarkan tanggal hari ini.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Sesi / jam pelajaran
                  </label>
                  <select
                    value={sessionSlot}
                    onChange={(e) => setSessionSlot(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">— Pilih sesi —</option>
                    {SESSIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Keterangan tambahan
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tuliskan keterangan atau alasan jika ada..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                {needEvidence && (
                  <div
                    className="space-y-3 p-3 rounded-lg border"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--accent-border)" }}
                  >
                    <div className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                      Bukti tambahan (wajib salah satu atau keduanya)
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        Foto bukti
                      </label>
                      <input
                        type="file"
                        accept="image/*,.heic,.heif"
                        className="w-full text-xs"
                        onChange={(e) => void onPickEvidenceFile(e.target.files?.[0] ?? null)}
                      />
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Foto akan dioptimalkan otomatis (ukuran dan kualitas) agar ringan di server.
                      </p>
                      {evidenceDataUrl && (
                        <p className="text-[10px] mt-1" style={{ color: "var(--success)" }}>
                          Foto terpasang.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        Pengakuan / tanda tangan digital (teks)
                      </label>
                      <textarea
                        value={signatureText}
                        onChange={(e) => setSignatureText(e.target.value)}
                        placeholder={`Contoh: Saya menyatakan telah melanggar tata tertib. (nama lengkap, min. 12 karakter)`}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border text-xs resize-none"
                        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVtId("");
                      setSessionSlot("");
                      setNotes("");
                      setEvidenceDataUrl("");
                      setSignatureText("");
                      setIncidentDate(calendarTodayYmd());
                    }}
                    className="px-4 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--accent)" }}
                  >
                    {loading ? "Mengirim..." : "Kirim laporan"}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
                  Riwayat pelanggaran saya
                </h3>
              </div>
              {records.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Belum ada catatan pelanggaran
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "var(--bg-primary)" }}>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                        Tanggal
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                        Pelanggaran
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                        Poin
                      </th>
                      <th
                        className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase hidden sm:table-cell"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Ket.
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
                        Laporan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r: any) => (
                      <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {formatDate(r.date)}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>
                          {r.violationType.name}
                        </td>
                        <td className="px-4 py-3">
                          <PointBadge points={r.points} />
                        </td>
                        <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                          {r.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewRecordId(r.id)}
                              className="text-[11px] font-semibold hover:underline"
                              style={{ color: "var(--accent)" }}
                            >
                              Lihat detail{r.evidenceImagePresent ? " / foto" : ""}
                            </button>
                            <a
                              href={`/api/records/${encodeURIComponent(r.id)}/evidence-pdf`}
                              className="text-[11px] font-semibold hover:underline"
                              style={{ color: "var(--success)" }}
                            >
                              Unduh PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div
              className="mt-5 rounded-xl border overflow-hidden"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
                  Riwayat remisi & penyesuaian poin
                </h3>
                <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Daftar pengurangan atau penyesuaian (misalnya remisi 25% setelah periode tenang). Ini terpisah dari tabel
                  pelanggaran di atas.
                </p>
              </div>
              {pointAdjustments.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Belum ada remisi atau penyesuaian poin yang tercatat.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[340px]">
                    <thead>
                      <tr style={{ background: "var(--bg-primary)" }}>
                        <th
                          className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Tanggal
                        </th>
                        <th
                          className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Δ Poin
                        </th>
                        <th
                          className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap hidden sm:table-cell"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Total bruto saat itu
                        </th>
                        <th
                          className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase min-w-[8rem]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Keterangan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointAdjustments.map((a) => (
                        <tr key={a.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {formatInputDateTime(a.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdjustmentDelta delta={a.pointsDelta} />
                          </td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                            {a.grossTotalBefore}
                          </td>
                          <td className="px-4 py-3 text-xs leading-snug" style={{ color: "var(--text-primary)" }}>
                            <span className="block">{formatPointAdjustmentReason(a.reason)}</span>
                            <span className="mt-0.5 block text-[10px] sm:hidden" style={{ color: "var(--text-muted)" }}>
                              Total bruto saat itu: {a.grossTotalBefore}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
