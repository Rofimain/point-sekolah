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

export default function SettingsClient({
  initial,
  canResetPoints = false,
}: {
  initial: Record<string, string>;
  canResetPoints?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({ ...emptyForm(), ...initial }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgInfo, setTgInfo] = useState<Record<string, unknown> | null>(null);
  const [tgMsg, setTgMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

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

  async function resetAllViolationHistory() {
    const typed = window.prompt(
      'Hapus SEMUA catatan pelanggaran, foto bukti, dan remisi?\n\nKetik RESET_ALL_POINTS untuk konfirmasi:'
    );
    if (typed !== "RESET_ALL_POINTS") {
      setResetMsg(typed == null ? "" : "Dibatalkan — konfirmasi tidak cocok.");
      return;
    }
    if (!window.confirm("Yakin? Tindakan ini tidak bisa dibatalkan. Poin semua siswa jadi 0.")) return;

    setResetLoading(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/admin/clear-violation-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET_ALL_POINTS" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menghapus");
      setResetMsg(
        `Berhasil. Dihapus: ${d.deleted?.records ?? 0} catatan, ${d.deleted?.evidence ?? 0} bukti, ${d.deleted?.adjustments ?? 0} remisi.`
      );
      router.refresh();
    } catch (err: unknown) {
      setResetMsg(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setResetLoading(false);
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
        <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
          Pengaturan sekolah
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Batasan poin SP/skorsing. Nama pejabat cetak diisi saat mencetak surat.
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
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{
                    background: "var(--bg-primary)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
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

      {canResetPoints && (
        <div
          className="mt-8 w-full max-w-2xl space-y-3 rounded-xl border p-4 sm:p-5"
          style={{ background: "var(--danger-bg)", borderColor: "var(--danger)" }}
        >
          <h2 className="text-sm font-serif" style={{ color: "var(--danger)" }}>
            Zona berbahaya — reset poin
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Hapus seluruh riwayat pelanggaran siswa, foto bukti, dan remisi/penyesuaian. Master jenis pelanggaran,
            akun, dan kelas tetap aman. Poin semua siswa kembali 0.
          </p>
          <button
            type="button"
            disabled={resetLoading}
            onClick={() => void resetAllViolationHistory()}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--danger)" }}
          >
            {resetLoading ? "Menghapus…" : "Reset semua poin & riwayat"}
          </button>
          {resetMsg && (
            <p className="text-xs" style={{ color: resetMsg.startsWith("Berhasil") ? "var(--success)" : "var(--danger)" }}>
              {resetMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
