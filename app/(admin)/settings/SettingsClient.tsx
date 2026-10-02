"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_KEYS } from "@/lib/app-setting-keys";

const THRESHOLD_KEYS = [
  APP_KEYS.SP1_POINTS,
  APP_KEYS.SP2_POINTS,
  APP_KEYS.SP3_POINTS,
  APP_KEYS.SKORSING_POINTS,
] as const;

const LABELS: Record<(typeof THRESHOLD_KEYS)[number], string> = {
  [APP_KEYS.SP1_POINTS]: "Batas poin SP1",
  [APP_KEYS.SP2_POINTS]: "Batas poin SP2",
  [APP_KEYS.SP3_POINTS]: "Batas poin SP3",
  [APP_KEYS.SKORSING_POINTS]: "Batas poin skorsing",
};

function emptyForm(): Record<(typeof THRESHOLD_KEYS)[number], string> {
  return {
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
      for (const key of THRESHOLD_KEYS) payload[key] = form[key].trim();

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

  return (
    <div>
      <div className="mb-5">
        <h1 className="page-title">
          Pengaturan sekolah
        </h1>
        <p className="page-subtitle">
          Batasan poin SP/skorsing. Nama pejabat cetak diisi saat mencetak surat.
        </p>
        <p className="text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/remisi/input" className="font-semibold" style={{ color: "var(--accent)" }}>
            Poin Remisi &amp; Reward →
          </Link>
          <Link href="/settings/redaksi" className="font-semibold" style={{ color: "var(--accent)" }}>
            Redaksi cetak →
          </Link>
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="card w-full max-w-2xl space-y-6 p-5 sm:p-5"
      >
        <section className="space-y-4">
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
            Batasan poin SP &amp; skorsing
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Isi angka batas akumulasi poin. Kosongkan jika belum ingin ditetapkan.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {THRESHOLD_KEYS.map((key) => (
              <div key={key}>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {LABELS[key]}
                </label>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder="kosong = belum diatur"
                  inputMode="numeric"
                  className="input"
                />
              </div>
            ))}
          </div>
          {thresholdWarning && (
            <p className="text-xs" style={{ color: "var(--warning)" }}>
              {thresholdWarning}
            </p>
          )}
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
          className="btn btn-primary text-sm"
        >
          {loading ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>

      <div
        className="card mt-8 w-full max-w-2xl space-y-3 p-5 sm:p-5"
      >
        <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          Telegram — tautan orang tua &amp; webhook
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Kolom <strong style={{ color: "var(--text-secondary)" }}>Telegram ortu</strong> baru terisi setelah Telegram
          berhasil memanggil server saat ortu memakai tautan <code className="text-[11px]">t.me/…?start=ortu_…</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={tgLoading}
            onClick={() => void loadTelegramWebhookInfo()}
            className="btn btn-secondary text-xs disabled:opacity-50 btn-sm"
          >
            {tgLoading ? "Memuat…" : "Cek status webhook"}
          </button>
          <button
            type="button"
            disabled={tgLoading}
            onClick={() => void registerTelegramWebhook()}
            className="btn btn-primary text-xs btn-sm"
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
            className="max-h-48 overflow-auto rounded-lg border p-3 text-[11px] leading-relaxed"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)" }}
          >
            {JSON.stringify(tgInfo, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
