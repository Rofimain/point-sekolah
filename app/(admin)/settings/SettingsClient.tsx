"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_KEYS } from "@/lib/app-settings";

const SETTING_KEYS = [
  APP_KEYS.COORD_NAME,
  APP_KEYS.COORD_TITLE,
  APP_KEYS.REDAKSI_PRINT,
  APP_KEYS.NEXT_REVIEW_VIOLATIONS,
  APP_KEYS.NEXT_REVIEW_ROSTER,
] as const;

const LABELS: Record<(typeof SETTING_KEYS)[number], string> = {
  [APP_KEYS.COORD_NAME]: "Nama koordinator (untuk tanda tangan cetak)",
  [APP_KEYS.COORD_TITLE]: "Jabatan koordinator (mis. Koordinator BP/BK)",
  [APP_KEYS.REDAKSI_PRINT]: "Redaksi resmi pada lembar cetak info poin",
  [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: "Jadwal review poin / jenis pelanggaran (YYYY-MM-DD, opsional)",
  [APP_KEYS.NEXT_REVIEW_ROSTER]: "Jadwal review data murid & guru (YYYY-MM-DD, opsional)",
};

function emptyForm(): Record<(typeof SETTING_KEYS)[number], string> {
  return {
    [APP_KEYS.COORD_NAME]: "",
    [APP_KEYS.COORD_TITLE]: "",
    [APP_KEYS.REDAKSI_PRINT]: "",
    [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: "",
    [APP_KEYS.NEXT_REVIEW_ROSTER]: "",
  };
}

export default function SettingsClient({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({ ...emptyForm(), ...initial }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk(false);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menyimpan");
      }
      setOk(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
          Pengaturan sekolah
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Redaksi cetak, koordinator, dan pengingat jadwal pembaharuan (tata tertib & data peserta didik).
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="w-full max-w-2xl space-y-4 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        {SETTING_KEYS.map((key) => (
          <div key={key}>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              {LABELS[key]}
            </label>
            {key === APP_KEYS.REDAKSI_PRINT ? (
              <textarea
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg border text-sm resize-y"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            ) : (
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            )}
          </div>
        ))}

        {error && (
          <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        {ok && (
          <div className="p-3 rounded-lg text-xs" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            Pengaturan disimpan.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {loading ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
    </div>
  );
}
