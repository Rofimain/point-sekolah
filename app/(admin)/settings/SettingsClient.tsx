"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_KEYS } from "@/lib/app-setting-keys";
import { addMonthsFromYmd, reviewStatusLabel } from "@/lib/review-dates";

const GENERAL_KEYS = [
  APP_KEYS.COORD_NAME,
  APP_KEYS.COORD_TITLE,
  APP_KEYS.NEXT_REVIEW_VIOLATIONS,
  APP_KEYS.NEXT_REVIEW_ROSTER,
] as const;

const THRESHOLD_KEYS = [
  APP_KEYS.SP1_POINTS,
  APP_KEYS.SP2_POINTS,
  APP_KEYS.SP3_POINTS,
  APP_KEYS.SKORSING_POINTS,
] as const;

const SETTING_KEYS = [...GENERAL_KEYS, ...THRESHOLD_KEYS] as const;

const LABELS: Record<(typeof SETTING_KEYS)[number], string> = {
  [APP_KEYS.COORD_NAME]: "Nama koordinator (untuk tanda tangan cetak)",
  [APP_KEYS.COORD_TITLE]: "Jabatan koordinator (mis. Koordinator BP/BK)",
  [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: "Jadwal review poin / jenis pelanggaran (YYYY-MM-DD)",
  [APP_KEYS.NEXT_REVIEW_ROSTER]: "Jadwal review data murid & guru (YYYY-MM-DD)",
  [APP_KEYS.SP1_POINTS]: "Batas poin SP1",
  [APP_KEYS.SP2_POINTS]: "Batas poin SP2",
  [APP_KEYS.SP3_POINTS]: "Batas poin SP3",
  [APP_KEYS.SKORSING_POINTS]: "Batas poin skorsing",
};

const REVIEW_KEYS = [APP_KEYS.NEXT_REVIEW_VIOLATIONS, APP_KEYS.NEXT_REVIEW_ROSTER] as const;

function statusChip(status: ReturnType<typeof reviewStatusLabel>) {
  if (status === "overdue") return { label: "Terlewat", bg: "var(--danger-bg)", color: "var(--danger)" };
  if (status === "soon") return { label: "≤30 hari", bg: "var(--warning-bg)", color: "var(--warning)" };
  if (status === "ok") return { label: "Terjadwal", bg: "var(--success-bg)", color: "var(--success)" };
  return { label: "Belum diisi", bg: "var(--bg-tertiary)", color: "var(--text-muted)" };
}

function emptyForm(): Record<(typeof SETTING_KEYS)[number], string> {
  return {
    [APP_KEYS.COORD_NAME]: "",
    [APP_KEYS.COORD_TITLE]: "",
    [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: "",
    [APP_KEYS.NEXT_REVIEW_ROSTER]: "",
    [APP_KEYS.SP1_POINTS]: "",
    [APP_KEYS.SP2_POINTS]: "",
    [APP_KEYS.SP3_POINTS]: "",
    [APP_KEYS.SKORSING_POINTS]: "",
  };
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function SettingsClient({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({ ...emptyForm(), ...initial }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgInfo, setTgInfo] = useState<Record<string, unknown> | null>(null);
  const [tgMsg, setTgMsg] = useState("");

  const thresholdWarning = useMemo(() => {
    const sp1 = parseOptionalNumber(form[APP_KEYS.SP1_POINTS]);
    const sp2 = parseOptionalNumber(form[APP_KEYS.SP2_POINTS]);
    const sp3 = parseOptionalNumber(form[APP_KEYS.SP3_POINTS]);
    if (sp1 != null && sp2 != null && sp1 > sp2) return "SP1 sebaiknya ≤ SP2.";
    if (sp2 != null && sp3 != null && sp2 > sp3) return "SP2 sebaiknya ≤ SP3.";
    if (sp1 != null && sp3 != null && sp1 > sp3) return "SP1 sebaiknya ≤ SP3.";
    return "";
  }, [form]);

  function bumpReview(key: (typeof REVIEW_KEYS)[number], months: number) {
    setForm((prev) => ({
      ...prev,
      [key]: addMonthsFromYmd(prev[key], months),
    }));
  }

  async function loadTelegramWebhookInfo() {
    setTgLoading(true);
    setTgMsg("");
    try {
      const res = await fetch("/api/telegram/webhook-info");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal");
      setTgInfo(d);
    } catch (err: unknown) {
      setTgInfo(null);
      setTgMsg(err instanceof Error ? err.message : "Gagal");
    } finally {
      setTgLoading(false);
    }
  }

  async function registerTelegramWebhook() {
    setTgLoading(true);
    setTgMsg("");
    try {
      const res = await fetch("/api/telegram/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "setWebhook gagal");
      setTgMsg(`Webhook terdaftar: ${d.webhookUrl ?? ""}`);
      await loadTelegramWebhookInfo();
    } catch (err: unknown) {
      setTgMsg(err instanceof Error ? err.message : "Gagal");
    } finally {
      setTgLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk(false);

    for (const key of THRESHOLD_KEYS) {
      const raw = form[key].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        setError(`${LABELS[key]} harus bilangan bulat ≥ 0 (atau kosong).`);
        setLoading(false);
        return;
      }
    }

    try {
      const payload: Record<string, string> = {};
      for (const key of SETTING_KEYS) payload[key] = form[key].trim();

      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  function renderField(key: (typeof SETTING_KEYS)[number], opts?: { number?: boolean }) {
    const isReview = (REVIEW_KEYS as readonly string[]).includes(key);
    const chip = isReview ? statusChip(reviewStatusLabel(form[key])) : null;
    return (
      <div key={key}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            {LABELS[key]}
          </label>
          {chip && (
            <span className="badge-soft" style={{ background: chip.bg, color: chip.color }}>
              {chip.label}
            </span>
          )}
        </div>
        <input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={isReview ? "YYYY-MM-DD" : opts?.number ? "kosong = belum diatur" : undefined}
          inputMode={opts?.number ? "numeric" : undefined}
          className="w-full px-3 py-2.5 rounded-lg border text-sm"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        {isReview && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => bumpReview(key as (typeof REVIEW_KEYS)[number], 6)}
              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
            >
              +6 bulan
            </button>
            <button
              type="button"
              onClick={() => bumpReview(key as (typeof REVIEW_KEYS)[number], 12)}
              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
              style={{ borderColor: "var(--accent-border)", color: "var(--accent)", background: "var(--accent-light)" }}
            >
              +1 tahun
            </button>
            <span className="self-center text-[10px]" style={{ color: "var(--text-muted)" }}>
              dari tanggal di atas (atau hari ini jika kosong) — lalu Simpan
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
          Pengaturan sekolah
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Batasan poin SP/skorsing, koordinator, dan jadwal pembaharuan data.
        </p>
        <p className="text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/settings/remisi" className="font-semibold" style={{ color: "var(--accent)" }}>
            Poin Remisi &amp; Reward →
          </Link>
          <Link href="/settings/redaksi" className="font-semibold" style={{ color: "var(--accent)" }}>
            Redaksi cetak →
          </Link>
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="w-full max-w-2xl space-y-6 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <section className="space-y-4">
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
            Batasan poin SP &amp; skorsing
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Isi angka batas akumulasi poin. Kosongkan jika belum ingin ditetapkan.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {THRESHOLD_KEYS.map((key) => renderField(key, { number: true }))}
          </div>
          {thresholdWarning && (
            <p className="text-xs" style={{ color: "var(--warning)" }}>
              {thresholdWarning}
            </p>
          )}
        </section>

        <section className="space-y-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
            Koordinator &amp; jadwal review
          </h2>
          {GENERAL_KEYS.map((key) => renderField(key))}
        </section>

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

      <div
        className="mt-8 w-full max-w-2xl space-y-3 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          Telegram — tautan orang tua &amp; webhook
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Kolom <strong style={{ color: "var(--text-secondary)" }}>Telegram ortu</strong> baru terisi setelah Telegram
          berhasil memanggil server saat ortu memakai tautan <code className="text-[10px]">t.me/…?start=ortu_…</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={tgLoading}
            onClick={() => void loadTelegramWebhookInfo()}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
          >
            {tgLoading ? "Memuat…" : "Cek status webhook"}
          </button>
          <button
            type="button"
            disabled={tgLoading}
            onClick={() => void registerTelegramWebhook()}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            Daftarkan / perbarui webhook
          </button>
        </div>
        {tgMsg && (
          <p className="text-xs" style={{ color: tgMsg.includes("terdaftar") ? "var(--success)" : "var(--danger)" }}>
            {tgMsg}
          </p>
        )}
        {tgInfo && (
          <pre
            className="max-h-48 overflow-auto rounded-lg border p-3 text-[10px] leading-relaxed"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)" }}
          >
            {JSON.stringify(tgInfo, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
