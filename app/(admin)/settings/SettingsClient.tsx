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

const REMISI_KEYS = [APP_KEYS.REMISI_QUIET_DAYS, APP_KEYS.REMISI_PERCENT] as const;

const SETTING_KEYS = [...GENERAL_KEYS, ...THRESHOLD_KEYS, ...REMISI_KEYS] as const;

const LABELS: Record<(typeof SETTING_KEYS)[number], string> = {
  [APP_KEYS.COORD_NAME]: "Nama koordinator (untuk tanda tangan cetak)",
  [APP_KEYS.COORD_TITLE]: "Jabatan koordinator (mis. Koordinator BP/BK)",
  [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: "Jadwal review poin / jenis pelanggaran (YYYY-MM-DD)",
  [APP_KEYS.NEXT_REVIEW_ROSTER]: "Jadwal review data murid & guru (YYYY-MM-DD)",
  [APP_KEYS.SP1_POINTS]: "Batas poin SP1",
  [APP_KEYS.SP2_POINTS]: "Batas poin SP2",
  [APP_KEYS.SP3_POINTS]: "Batas poin SP3",
  [APP_KEYS.SKORSING_POINTS]: "Batas poin skorsing",
  [APP_KEYS.REMISI_QUIET_DAYS]: "Hari tenang sebelum remisi otomatis",
  [APP_KEYS.REMISI_PERCENT]: "Persentase remisi (%)",
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
    [APP_KEYS.REMISI_QUIET_DAYS]: "",
    [APP_KEYS.REMISI_PERCENT]: "",
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

  const [qmLoading, setQmLoading] = useState(false);
  const [qmPreview, setQmPreview] = useState<{
    quietDays: number;
    remisiPercent: number;
    eligible: { id: string; name: string; lastIncidentYmd?: string; daysQuiet?: number }[];
  } | null>(null);
  const [qmMsg, setQmMsg] = useState("");

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

  async function loadQuietPreview() {
    setQmLoading(true);
    setQmMsg("");
    try {
      const res = await fetch("/api/admin/quiet-month-preview");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal memuat pratinjau");
      setQmPreview({
        quietDays: d.quietDays ?? 30,
        remisiPercent: d.remisiPercent ?? 25,
        eligible: d.eligible ?? [],
      });
    } catch (err: unknown) {
      setQmPreview(null);
      setQmMsg(err instanceof Error ? err.message : "Gagal");
    } finally {
      setQmLoading(false);
    }
  }

  async function runQuietApply() {
    const pct = form[APP_KEYS.REMISI_PERCENT].trim() || "25";
    if (
      !confirm(
        `Terapkan remisi ${pct}% untuk semua siswa yang saat ini memenuhi syarat? Tindakan ini menulis penyesuaian poin di basis data.`
      )
    ) {
      return;
    }
    setQmLoading(true);
    setQmMsg("");
    try {
      const res = await fetch("/api/admin/quiet-month-apply", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menerapkan remisi");
      setQmMsg(`Selesai: ${d.count ?? 0} siswa mendapat remisi.`);
      setQmPreview(null);
      router.refresh();
    } catch (err: unknown) {
      setQmMsg(err instanceof Error ? err.message : "Gagal");
    } finally {
      setQmLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOk(false);

    for (const key of [...THRESHOLD_KEYS, ...REMISI_KEYS]) {
      const raw = form[key].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        setError(`${LABELS[key]} harus bilangan bulat ≥ 0 (atau kosong).`);
        setLoading(false);
        return;
      }
      if (key === APP_KEYS.REMISI_PERCENT && n > 100) {
        setError("Persentase remisi maksimal 100.");
        setLoading(false);
        return;
      }
      if (key === APP_KEYS.REMISI_QUIET_DAYS && n < 1) {
        setError("Hari tenang harus ≥ 1 jika diisi.");
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
          Batasan poin SP/skorsing, remisi otomatis &amp; manual, koordinator, serta jadwal pembaharuan data.
        </p>
        <p className="text-xs mt-2">
          <Link href="/settings/redaksi" className="font-semibold" style={{ color: "var(--accent)" }}>
            Kelola redaksi cetak →
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
            Isi angka batas akumulasi poin. Kosongkan jika belum ingin ditetapkan. Nilai ini disimpan untuk dipakai tahap
            generate surat berikutnya.
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
            Remisi (periode tenang)
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Jika dikosongkan: hari tenang memakai env <code className="text-[10px]">POINT_REDUCTION_QUIET_DAYS</code>{" "}
            (default 30), persentase remisi default 25%.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REMISI_KEYS.map((key) => renderField(key, { number: true }))}
          </div>
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
          Remisi manual
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Cek siswa yang sudah memenuhi hari tenang sejak tanggal kejadian pelanggaran terakhir, lalu terapkan remisi
          sekarang. Remisi otomatis harian tetap berjalan lewat cron{" "}
          <code className="text-[10px]">POST /api/cron/quiet-month-points</code> (butuh{" "}
          <code className="text-[10px]">CRON_SECRET</code>).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={qmLoading}
            onClick={loadQuietPreview}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
          >
            {qmLoading ? "Memuat…" : "Cek siswa layak remisi"}
          </button>
          <button
            type="button"
            disabled={qmLoading}
            onClick={runQuietApply}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            Terapkan remisi sekarang
          </button>
        </div>
        {qmPreview && (
          <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>
              Periode tenang: {qmPreview.quietDays} hari · Remisi: {qmPreview.remisiPercent}% · Layak:{" "}
              {qmPreview.eligible.length} siswa
            </p>
            {qmPreview.eligible.length > 0 ? (
              <ul className="mt-2 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto" style={{ color: "var(--text-muted)" }}>
                {qmPreview.eligible.map((s) => (
                  <li key={s.id}>
                    {s.name}
                    {s.lastIncidentYmd != null && s.daysQuiet != null
                      ? ` — kejadian ${s.lastIncidentYmd}, ${s.daysQuiet} hari tenang`
                      : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2" style={{ color: "var(--text-muted)" }}>
                Tidak ada siswa yang memenuhi syarat (belum cukup hari tenang sejak tanggal kejadian terakhir, atau remisi
                untuk periode itu sudah pernah diterapkan).
              </p>
            )}
          </div>
        )}
        {qmMsg && (
          <p className="text-xs" style={{ color: qmMsg.startsWith("Selesai") ? "var(--success)" : "var(--danger)" }}>
            {qmMsg}
          </p>
        )}
      </div>

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
          Wajib: <code className="text-[10px]">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>,{" "}
          <code className="text-[10px]">TELEGRAM_BOT_TOKEN</code>, dan <strong>URL webhook terdaftar</strong> di Telegram
          (bukan hanya env).
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
