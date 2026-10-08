"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveManualRemisiPercent } from "@/lib/remisi-rules";
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
  effective: number;
  percent: number | null;
  pointsDelta: number | null;
  effectiveAfter: number;
};

export default function RemisiClient({ students }: { students: RemisiStudentRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customPercent, setCustomPercent] = useState("10");
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

  const localPercent = useMemo(() => {
    const resolved = resolveManualRemisiPercent(Number(customPercent));
    return resolved.ok ? resolved.percent : null;
  }, [customPercent]);

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
          customPercent,
        });
        const res = await fetch(`/api/admin/manual-remisi?${sp}`, { signal: ctrl.signal });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Gagal memuat pratinjau");
        setPreview({
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
  }, [selectedId, achievementYmd, customPercent, localPercent]);

  async function applyManual() {
    if (!selectedId) {
      setMsg({ type: "err", text: "Pilih siswa terlebih dahulu." });
      return;
    }
    if (!achievementYmd) {
      setMsg({ type: "err", text: "Tanggal prestasi wajib diisi." });
      return;
    }
    if (customLabel.trim().length < 2) {
      setMsg({ type: "err", text: "Nama jenis remisi/reward wajib diisi." });
      return;
    }
    const n = Number(customPercent);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      setMsg({ type: "err", text: "Persentase wajib 1–100." });
      return;
    }

    const confirmBits = [
      `Jenis: ${customLabel.trim()}`,
      `Tanggal prestasi: ${achievementYmd}`,
      preview ? `Poin saat ini: ${preview.effective}` : null,
      `Persen: ${n}%`,
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
          achievementYmd,
          customPercent: n,
          customLabel: customLabel.trim(),
          note: note.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan");
      setMsg({
        type: "ok",
        text: `Berhasil: ${d.studentName} −${Math.abs(d.pointsDelta)} poin (${d.percent}% · ${d.customLabel}) dari poin saat ini ${d.grossTotalBefore}. Poin efektif sekarang ${d.effectiveAfter}.`,
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
        <Link href="/remisi/manual" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          ← Riwayat remisi manual
        </Link>
        <h1 className="page-title mt-2">
          Poin Remisi &amp; Reward
        </h1>
        <p className="page-subtitle">
          Remisi otomatis berjalan sendiri; di halaman ini Admin/Super Admin memberi remisi/reward manual ke siswa.
        </p>
      </div>

      <div
        className="card mb-6 w-full max-w-3xl space-y-2 p-5 sm:p-5"
      >
        <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          1. Remisi otomatis
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Setiap 1 bulan kalender tanpa pelanggaran sejak tanggal kejadian terakhir, poin dikurangi 25% dari sisa poin
          (dibulatkan ke atas) dan berulang tiap bulan sampai poin 0. Pelanggaran baru mengulang hitungan.
        </p>
      </div>

      <div
        className="card w-full max-w-3xl space-y-4 p-5 sm:p-5"
      >
        <div>
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
            2. Remisi &amp; reward manual
          </h2>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Isi nama jenis dan persentase sendiri. Persen dihitung dari poin siswa saat ini. Input yang sama
            kedua kalinya memakai sisa poin setelah remisi pertama, jadi potongannya bisa lebih kecil.
          </p>
        </div>

        <div>
          <label
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Cari siswa
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama / NISN / kelas"
            className="input"
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
            Dipilih: <strong style={{ color: "var(--text-primary)" }}>{selected.name}</strong> — bruto {selected.gross},
            efektif {selected.effective}
          </p>
        )}

        <div>
          <label
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Nama jenis remisi / reward *
          </label>
          <input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Mis. Juara lomba robotik / Remisi khusus OSIS / Hafalan Yasin"
            className="input"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Persentase pengurangan (%) *
          </label>
          <input
            value={customPercent}
            onChange={(e) => setCustomPercent(e.target.value)}
            inputMode="numeric"
            min={1}
            max={100}
            className="input max-w-[8rem]"
          />
        </div>

        <div>
          <label
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Tanggal prestasi *
          </label>
          <input
            type="date"
            value={achievementYmd}
            onChange={(e) => setAchievementYmd(e.target.value)}
            min="2015-01-01"
            max={calendarTodayYmd()}
            className="input max-w-xs"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Tanggal kejadian prestasi. Persen dihitung dari poin siswa saat ini. Tetap harus ada poin pelanggaran pada
            atau sebelum tanggal ini.
          </p>
        </div>

        <div>
          <label
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Catatan (opsional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mis. juara 1 lomba pidato / surat keterangan terlampir"
            className="input"
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
          <div
            className="rounded-lg border px-3 py-2.5 text-xs space-y-1"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <p>
              Poin saat ini:{" "}
              <strong style={{ color: "var(--text-primary)" }}>{preview.effective}</strong>
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
          className="btn btn-primary text-sm"
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
