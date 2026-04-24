"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layouts/TopBar";
import { formatDate, getInitials } from "@/lib/utils";
import type { Session } from "next-auth";

const SESSIONS = ["Jam 1-2", "Jam 3-4", "Jam 5-6", "Jam 7-8", "Istirahat / Umum"];
const CRITICAL = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75");
const WARNING = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "50");

function PointBadge({ points }: { points: number }) {
  const color = points >= 25 ? "var(--danger)" : points >= 10 ? "var(--warning)" : "var(--success)";
  const bg = points >= 25 ? "var(--danger-bg)" : points >= 10 ? "var(--warning-bg)" : "var(--success-bg)";
  return <span className="inline-flex items-center justify-center w-9 h-5 rounded-full text-xs font-bold" style={{ background: bg, color }}>{points}</span>;
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, [string, string]> = {
    RINGAN: ["var(--success-bg)", "var(--success)"],
    SEDANG: ["var(--warning-bg)", "var(--warning)"],
    BERAT: ["var(--danger-bg)", "var(--danger)"],
    };
  const [bg, color] = map[category] || ["var(--bg-tertiary)", "var(--text-muted)"];
  const labels: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color }}>{labels[category] || category}</span>;
}

export default function StudentFormClient({ session, violationTypes, records, totalPoints, studentClass, studentNisn }: any) {
  const router = useRouter();
  const [vtId, setVtId] = useState("");
  const [sessionSlot, setSessionSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedVt = violationTypes.find((v: any) => v.id === vtId);
  const pointStatus = totalPoints >= CRITICAL ? "kritis" : totalPoints >= WARNING ? "perhatian" : "aman";
  const pointColor = pointStatus === "kritis" ? "var(--danger)" : pointStatus === "perhatian" ? "var(--warning)" : "var(--success)";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vtId) { setError("Pilih jenis pelanggaran terlebih dahulu"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violationTypeId: vtId, session: sessionSlot, notes }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Gagal mengirim"); }
      setSuccess(true); setVtId(""); setSessionSlot(""); setNotes("");
      setTimeout(() => { setSuccess(false); router.refresh(); }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <TopBar />
      <div className="max-w-2xl mx-auto p-5">
        {/* Student Header Card */}
        <div className="rounded-xl p-4 mb-5 flex items-center gap-3" style={{ background: "var(--bg-sidebar)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-serif text-sm" style={{ background: "rgba(255,255,255,0.15)" }}>
            {getInitials(session.user.name || "S")}
          </div>
          <div className="flex-1">
            <div className="text-sm font-serif text-white">{session.user.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              {studentClass || "Kelas tidak ditetapkan"} {studentNisn ? `· NISN: ${studentNisn}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Total Poin</div>
            <div className="text-2xl font-serif font-bold" style={{ color: pointColor }}>{totalPoints}</div>
            <div className="text-[9px] capitalize" style={{ color: pointColor }}>{pointStatus}</div>
          </div>
        </div>

        {/* Warning if high points */}
        {totalPoints >= WARNING && (
          <div className="p-3 rounded-lg text-xs mb-4 flex items-start gap-2" style={{ background: totalPoints >= CRITICAL ? "var(--danger-bg)" : "var(--warning-bg)", color: totalPoints >= CRITICAL ? "var(--danger)" : "var(--warning)" }}>
            <span>⚠</span>
            <span>Poin Anda sudah mencapai <strong>{totalPoints}</strong>. {totalPoints >= CRITICAL ? "Segera temui wali kelas / BK." : "Perhatikan perilaku Anda."}</span>
          </div>
        )}

        {/* Info box */}
        <div className="p-3 rounded-lg text-xs mb-5" style={{ background: "var(--warning-bg)", color: "var(--warning)", borderLeft: "3px solid var(--warning)" }}>
          Pengisian formulir ini bersifat wajib dan tercatat secara resmi. Pastikan data yang diisi akurat dan sesuai dengan pelanggaran yang dilakukan hari ini.
        </div>

        {/* Form */}
        <div className="rounded-xl border p-5 mb-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <h2 className="text-sm font-serif mb-4 pb-3 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>
            Formulir Pelaporan Pelanggaran — {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </h2>

          {success && (
            <div className="p-3 rounded-lg text-xs mb-4" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              ✓ Laporan berhasil dikirim
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Jenis Pelanggaran *</label>
              <select value={vtId} onChange={(e) => setVtId(e.target.value)} required className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="">— Pilih jenis pelanggaran —</option>
                {["RINGAN","SEDANG","BERAT"].map(cat => {
                  const items = violationTypes.filter((v: any) => v.category === cat);
                  if (!items.length) return null;
                  const labels: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };
                  return (
                    <optgroup key={cat} label={`— ${labels[cat]} —`}>
                      {items.map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.points} poin)</option>)}
                    </optgroup>
                  );
                })}
              </select>
              {selectedVt && (
                <div className="flex items-center gap-2 mt-1.5">
                  <CategoryBadge category={selectedVt.category} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{selectedVt.points} poin {selectedVt.description ? `· ${selectedVt.description}` : ""}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Sesi / Jam Pelajaran</label>
              <select value={sessionSlot} onChange={(e) => setSessionSlot(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="">— Pilih sesi —</option>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Keterangan Tambahan</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tuliskan keterangan atau alasan jika ada..." rows={3} className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>

            {error && <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>⚠ {error}</div>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setVtId(""); setSessionSlot(""); setNotes(""); }} className="px-4 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>Batal</button>
              <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>{loading ? "Mengirim..." : "Kirim Laporan"}</button>
            </div>
          </form>
        </div>

        {/* History */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>Riwayat Pelanggaran Saya</h3>
          </div>
          {records.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Belum ada catatan pelanggaran</div>
          ) : (
            <table className="w-full">
              <thead><tr style={{ background: "var(--bg-primary)" }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>Tanggal</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>Pelanggaran</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>Poin</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Ket.</th>
              </tr></thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{r.violationType.name}</td>
                    <td className="px-4 py-3"><PointBadge points={r.points} /></td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
