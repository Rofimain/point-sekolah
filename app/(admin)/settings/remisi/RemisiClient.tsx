"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUTO_REMISI_PERCENT,
  AUTO_REMISI_QUIET_DAYS,
  MANUAL_REMISI_DEFS,
  MANUAL_REMISI_TYPE,
  getManualRemisiDef,
  resolveManualRemisiPercent,
  type ManualRemisiType,
} from "@/lib/remisi-rules";

export type RemisiStudentRow = {
  id: string;
  name: string;
  nisn: string | null;
  className: string | null;
  gross: number;
  effective: number;
};

export default function RemisiClient({ students }: { students: RemisiStudentRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [type, setType] = useState<ManualRemisiType>(MANUAL_REMISI_TYPE.JUARA_SEKOLAH);
  const [customPercent, setCustomPercent] = useState("10");
  const [multiplier, setMultiplier] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 40);
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.nisn?.toLowerCase().includes(q) ?? false) ||
          (s.className?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 40);
  }, [students, search]);

  const selected = students.find((s) => s.id === selectedId) ?? null;
  const def = getManualRemisiDef(type);

  const preview = useMemo(() => {
    if (!selected || !def) return null;
    const resolved = resolveManualRemisiPercent(type, {
      customPercent: Number(customPercent),
      multiplier: Number(multiplier),
    });
    if (!resolved.ok) return { error: resolved.error };
    const deduct = Math.round(selected.gross * (resolved.percent / 100));
    const pointsDelta = -Math.min(deduct, selected.effective);
    return {
      percent: resolved.percent,
      pointsDelta,
      effectiveAfter: Math.max(0, selected.effective + pointsDelta),
    };
  }, [selected, def, type, customPercent, multiplier]);

  async function applyManual() {
    if (!selectedId) {
      setMsg({ type: "err", text: "Pilih siswa terlebih dahulu." });
      return;
    }
    if (!confirm("Terapkan remisi/reward ini ke siswa yang dipilih?")) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/manual-remisi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedId,
          type,
          customPercent: def?.fixedPercent == null ? Number(customPercent) : undefined,
          multiplier: def?.allowMultiplier ? Number(multiplier) : undefined,
          note: note.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan");
      setMsg({
        type: "ok",
        text: `Berhasil: ${d.studentName} −${Math.abs(d.pointsDelta)} poin (${d.percent}%). Poin efektif sekarang ${d.effectiveAfter}.`,
      });
      setNote("");
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/settings" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          ← Pengaturan sekolah
        </Link>
        <h1 className="text-lg font-serif mt-2" style={{ color: "var(--text-primary)" }}>
          Poin Remisi &amp; Reward
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Remisi otomatis berjalan sendiri; di halaman ini Anda memberi remisi/reward manual ke siswa.
        </p>
      </div>

      <div
        className="mb-6 w-full max-w-3xl space-y-2 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          1. Remisi otomatis (periode tenang)
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Jika murid tidak melanggar selama {AUTO_REMISI_QUIET_DAYS} hari sejak tanggal kejadian terakhir, sistem
          otomatis mengurangi {AUTO_REMISI_PERCENT}% dari total skor pelanggaran (cron harian). Tidak perlu diatur
          atau ditekan tombol apa pun.
        </p>
      </div>

      <div
        className="w-full max-w-3xl space-y-4 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div>
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
            2–5. Remisi &amp; reward manual
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Admin/Super Admin memberikan kepada siswa tertentu: juara kejuaraan, prestasi rekomendasi, hafalan, atau
            khotib Jumat. Dihitung dari total skor pelanggaran (bruto).
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Cari siswa
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama / NISN / kelas"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
          />
          <ul
            className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border p-1"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
          >
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(s.id);
                    setMsg(null);
                  }}
                  className="w-full rounded-md px-2.5 py-2 text-left text-xs"
                  style={{
                    background: s.id === selectedId ? "var(--accent-light)" : "transparent",
                    color: s.id === selectedId ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: s.id === selectedId ? 600 : 500,
                  }}
                >
                  {s.name}
                  <span className="ml-1" style={{ color: "var(--text-muted)" }}>
                    · {s.className ?? "—"} · bruto {s.gross} · efektif {s.effective}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Tidak ada siswa cocok.
              </li>
            )}
          </ul>
        </div>

        {selected && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Dipilih: <strong style={{ color: "var(--text-primary)" }}>{selected.name}</strong> — bruto{" "}
            {selected.gross}, efektif {selected.effective}
          </p>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Jenis remisi / reward
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ManualRemisiType)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
          >
            {MANUAL_REMISI_DEFS.map((d) => (
              <option key={d.type} value={d.type}>
                {d.label}
              </option>
            ))}
          </select>
          {def && (
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {def.description}
            </p>
          )}
        </div>

        {def?.fixedPercent == null && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Persentase rekomendasi (%)
            </label>
            <input
              value={customPercent}
              onChange={(e) => setCustomPercent(e.target.value)}
              inputMode="numeric"
              className="w-full max-w-[8rem] rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
            />
          </div>
        )}

        {def?.allowMultiplier && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Jumlah unit (surat/juz) × 10%
            </label>
            <input
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              inputMode="numeric"
              className="w-full max-w-[8rem] rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            Catatan (opsional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mis. juara 1 lomba pidato / hafal Yasin & Al-Mulk"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
          />
        </div>

        {preview && "error" in preview && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {preview.error}
          </p>
        )}
        {preview && !("error" in preview) && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Pratinjau: {preview.percent}% → potong {Math.abs(preview.pointsDelta)} poin · efektif setelah ≈{" "}
            {preview.effectiveAfter}
          </p>
        )}

        <button
          type="button"
          disabled={saving || !selectedId}
          onClick={() => void applyManual()}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "Menerapkan…" : "Terapkan ke siswa"}
        </button>

        {msg && (
          <p className="text-xs" style={{ color: msg.type === "ok" ? "var(--success)" : "var(--danger)" }}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
