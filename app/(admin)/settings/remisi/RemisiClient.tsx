"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { calendarTodayYmd } from "@/lib/incident-date";

export type RemisiStudentRow = {
  id: string;
  name: string;
  nisn: string | null;
  className: string | null;
  gross: number;
  effective: number;
};

type PreviewState = {
  eligibleGross: number;
  grossTotal: number;
  effective: number;
  percent: number | null;
  pointsDelta: number | null;
  effectiveAfter: number;
};

export default function RemisiClient({ students }: { students: RemisiStudentRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [type, setType] = useState<ManualRemisiType>(MANUAL_REMISI_TYPE.JUARA_SEKOLAH);
  const [customPercent, setCustomPercent] = useState("15");
  const [customLabel, setCustomLabel] = useState("");
  const [multiplier, setMultiplier] = useState("1");
  const [achievementYmd, setAchievementYmd] = useState(() => calendarTodayYmd());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState("");
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
  const needsPercent = def?.fixedPercent == null;
  const needsLabel = Boolean(def?.requireCustomLabel);

  const localPercent = useMemo(() => {
    const resolved = resolveManualRemisiPercent(type, {
      customPercent: Number(customPercent),
      multiplier: Number(multiplier),
    });
    return resolved.ok ? resolved.percent : null;
  }, [type, customPercent, multiplier]);

  useEffect(() => {
    if (!selectedId || !achievementYmd) {
      setPreview(null);
      setPreviewError("");
      return;
    }

    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const sp = new URLSearchParams({
          studentId: selectedId,
          achievementYmd,
          type,
        });
        if (needsPercent) sp.set("customPercent", customPercent);
        if (def?.allowMultiplier) sp.set("multiplier", multiplier);
        const res = await fetch(`/api/admin/manual-remisi?${sp}`, { signal: ctrl.signal });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Gagal memuat pratinjau");
        setPreview({
          eligibleGross: d.eligibleGross ?? 0,
          grossTotal: d.grossTotal ?? 0,
          effective: d.effective ?? 0,
          percent: d.percent ?? localPercent,
          pointsDelta: d.pointsDelta,
          effectiveAfter: d.effectiveAfter ?? d.effective ?? 0,
        });
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        setPreview(null);
        setPreviewError(err instanceof Error ? err.message : "Gagal pratinjau");
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [
    selectedId,
    achievementYmd,
    type,
    customPercent,
    multiplier,
    needsPercent,
    def?.allowMultiplier,
    localPercent,
  ]);

  async function applyManual() {
    if (!selectedId) {
      setMsg({ type: "err", text: "Pilih siswa terlebih dahulu." });
      return;
    }
    if (!achievementYmd) {
      setMsg({ type: "err", text: "Tanggal prestasi wajib diisi." });
      return;
    }
    if (needsLabel && customLabel.trim().length < 2) {
      setMsg({ type: "err", text: "Nama jenis remisi/reward wajib diisi." });
      return;
    }
    if (needsPercent) {
      const n = Number(customPercent);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        setMsg({ type: "err", text: "Persentase wajib 1–100." });
        return;
      }
    }

    const confirmBits = [
      `Tanggal prestasi: ${achievementYmd}`,
      preview ? `Basis poin (≤ tanggal): ${preview.eligibleGross}` : null,
      localPercent != null ? `Persen: ${localPercent}%` : null,
      preview?.pointsDelta != null ? `Potongan ≈ ${Math.abs(preview.pointsDelta)} poin` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!confirm(`Terapkan remisi/reward ke siswa yang dipilih?\n\n${confirmBits}`)) return;

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/manual-remisi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedId,
          type,
          achievementYmd,
          customPercent: needsPercent ? Number(customPercent) : undefined,
          multiplier: def?.allowMultiplier ? Number(multiplier) : undefined,
          customLabel: needsLabel ? customLabel.trim() : undefined,
          note: note.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan");
      setMsg({
        type: "ok",
        text: `Berhasil: ${d.studentName} −${Math.abs(d.pointsDelta)} poin (${d.percent}%) dari basis ${d.eligibleGross} poin (≤ ${d.achievementYmd}). Poin efektif sekarang ${d.effectiveAfter}.`,
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
            2. Remisi &amp; reward manual
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Remisi dihitung dari poin pelanggaran dengan tanggal kejadian{" "}
            <strong>pada/sebelum tanggal prestasi</strong>. Poin mulai hari berikutnya sampai hari ini tidak ikut
            dihitung.
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
            onChange={(e) => {
              const next = e.target.value as ManualRemisiType;
              setType(next);
              const nextDef = getManualRemisiDef(next);
              if (nextDef?.fixedPercent != null) {
                setCustomPercent(String(nextDef.fixedPercent));
              } else if (next === MANUAL_REMISI_TYPE.CUSTOM) {
                setCustomPercent("10");
              }
              setMsg(null);
            }}
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

        {needsLabel && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Nama jenis (manual) *
            </label>
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Mis. Juara lomba robotik / Remisi khusus OSIS"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
            />
          </div>
        )}

        {needsPercent && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Persentase pengurangan (%) *
            </label>
            <input
              value={customPercent}
              onChange={(e) => setCustomPercent(e.target.value)}
              inputMode="numeric"
              min={1}
              max={100}
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
            Tanggal prestasi *
          </label>
          <input
            type="date"
            value={achievementYmd}
            onChange={(e) => setAchievementYmd(e.target.value)}
            min="2015-01-01"
            max={calendarTodayYmd()}
            className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Contoh: prestasi 10 Jul 2026 → yang diremisi hanya poin kejadian ≤ 10 Jul 2026. Poin 11 Jul 2026 s.d. hari
            ini tidak termasuk.
          </p>
        </div>

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

        {previewLoading && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Menghitung pratinjau…
          </p>
        )}
        {previewError && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {previewError}
          </p>
        )}
        {preview && !previewLoading && (
          <div className="rounded-lg border px-3 py-2.5 text-xs space-y-1" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <p>
              Basis remisi (poin ≤ {achievementYmd}): <strong style={{ color: "var(--text-primary)" }}>{preview.eligibleGross}</strong>
              {preview.grossTotal !== preview.eligibleGross ? (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  · bruto total {preview.grossTotal} (selisih setelah tanggal tidak dihitung)
                </span>
              ) : null}
            </p>
            {preview.percent != null && preview.pointsDelta != null ? (
              <p>
                Pratinjau: {preview.percent}% → potong {Math.abs(preview.pointsDelta)} poin · efektif setelah ≈{" "}
                {preview.effectiveAfter}
              </p>
            ) : null}
          </div>
        )}

        <button
          type="button"
          disabled={saving || !selectedId || !achievementYmd}
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
