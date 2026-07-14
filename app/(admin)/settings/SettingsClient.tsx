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

  const [qmLoading, setQmLoading] = useState(false);
  const [qmPreview, setQmPreview] = useState<{ quietDays: number; eligible: { id: string; name: string }[] } | null>(
    null
  );
  const [qmMsg, setQmMsg] = useState("");

  const [tgLoading, setTgLoading] = useState(false);
  const [tgInfo, setTgInfo] = useState<Record<string, unknown> | null>(null);
  const [tgMsg, setTgMsg] = useState("");

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
      const res = await fetch("/api/telegram/set-webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
      setQmPreview({ quietDays: d.quietDays ?? 30, eligible: d.eligible ?? [] });
    } catch (err: unknown) {
      setQmPreview(null);
      setQmMsg(err instanceof Error ? err.message : "Gagal");
    } finally {
      setQmLoading(false);
    }
  }

  async function runQuietApply() {
    if (!confirm("Terapkan remisi 25% untuk semua siswa yang saat ini memenuhi syarat? Tindakan ini menulis penyesuaian poin di basis data.")) {
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

      <div
        className="mt-8 w-full max-w-2xl space-y-3 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          Telegram — tautan orang tua & webhook
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Kolom <strong style={{ color: "var(--text-secondary)" }}>Telegram ortu</strong> baru terisi setelah Telegram
          berhasil memanggil server saat ortu memakai tautan <code className="text-[10px]">t.me/…?start=ortu_…</code>.
          Wajib: <code className="text-[10px]">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>,{" "}
          <code className="text-[10px]">TELEGRAM_BOT_TOKEN</code>, dan{" "}
          <strong>URL webhook terdaftar</strong> di Telegram (bukan hanya env).
        </p>
        <ol className="list-inside list-decimal space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <li>Klik &quot;Daftarkan webhook&quot; di bawah (pastikan <code className="text-[10px]">NEXTAUTH_URL</code> = domain production HTTPS).</li>
          <li>
            Setelah mengisi <code className="text-[10px]">TELEGRAM_WEBHOOK_SECRET</code>, daftarkan lagi supaya header cocok. Telegram hanya
            mengizinkan huruf, angka, <code className="text-[10px]">_</code>, dan <code className="text-[10px]">-</code> (contoh:{" "}
            <code className="text-[10px]">openssl rand -hex 32</code>) — bukan token bot; hindari base64 dengan{" "}
            <code className="text-[10px]">+</code> / <code className="text-[10px]">/</code> / <code className="text-[10px]">=</code>.
          </li>
          <li>Di Manajemen Pengguna → siswa → &quot;Salin tautan Telegram ortu&quot; — kirim link itu ke ortu (bukan link lama).</li>
          <li>Jika kolom masih kosong: buka &quot;Cek status webhook&quot; — lihat{" "}
            <code className="text-[10px]">last_error_message</code> (mis. 403 = secret salah; URL kosong = belum register).</li>
        </ol>
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

      <div
        className="mt-8 w-full max-w-2xl space-y-3 rounded-xl border p-4 sm:p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
          Remisi otomatis (periode tenang)
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Bila siswa memiliki poin dari pelanggaran dan <strong>tidak ada catatan pelanggaran baru</strong> selama minimal
          jumlah hari di environment <code className="text-[10px]">POINT_REDUCTION_QUIET_DAYS</code> (default 30), sistem
          dapat mengurangi <strong>25% dari total poin bruto</strong> lewat penyesuaian poin. Untuk produksi, jadwalkan
          cron Linux di server yang memanggil{" "}
          <code className="text-[10px]">POST /api/cron/quiet-month-points</code> dengan header{" "}
          <code className="text-[10px]">x-cron-secret</code> sesuai <code className="text-[10px]">CRON_SECRET</code>.
          (Sebelumnya Vercel Cron — tidak lagi relevan di self-hosted.)
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
              Periode tenang: {qmPreview.quietDays} hari tanpa pelanggaran baru · Layak saat ini: {qmPreview.eligible.length}{" "}
              siswa
            </p>
            {qmPreview.eligible.length > 0 ? (
              <ul className="mt-2 max-h-36 list-inside list-disc space-y-0.5 overflow-y-auto" style={{ color: "var(--text-muted)" }}>
                {qmPreview.eligible.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2" style={{ color: "var(--text-muted)" }}>
                Tidak ada siswa yang memenuhi syarat (belum cukup hari tenang sejak pelanggaran terakhir, atau remisi
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
    </div>
  );
}
