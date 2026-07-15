"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function ChangePasswordDialog({
  role,
  onClose,
}: {
  role: string;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Gagal mengubah password.");
      await signOut({ callbackUrl: role === "STUDENT" ? "/login" : "/admin/login" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengubah password.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <button type="button" className="absolute inset-0" aria-label="Tutup dialog" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="change-password-title" className="font-serif text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Ubah password
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Minimal 12 karakter. Setelah berhasil, semua sesi akun akan keluar.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Tutup
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Password saat ini
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
          <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Password baru
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
          <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Ulangi password baru
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={loading} className="btn-primary mt-5 w-full px-4 py-3 text-sm disabled:opacity-60">
          {loading ? "Menyimpan..." : "Simpan password baru"}
        </button>
      </form>
    </div>
  );
}
