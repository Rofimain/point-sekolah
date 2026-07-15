"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SCHOOL_NAME } from "@/lib/branding";

function toStaffCredential(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("admin-login", {
      email: toStaffCredential(identifier),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      window.location.assign("/dashboard");
    }
  }

  return (
    <div
      className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center px-4 pt-10 pb-safe-bottom"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-sm rounded-2xl border p-5 sm:p-8 panel" style={{ borderColor: "var(--border)" }}>
        <div className="text-center mb-6">
          <BrandLogo size={56} priority className="mx-auto mb-3 h-14 w-14" />
          <h1 className="font-serif text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Portal Admin — Guru & Staff</h1>
          <p className="text-xs mt-1.5 tracking-wide" style={{ color: "var(--text-muted)" }}>{SCHOOL_NAME} · Sistem Poin Pelanggaran</p>
        </div>
        <div className="h-px mb-6" style={{ background: "linear-gradient(90deg, transparent, var(--gold), transparent)", opacity: 0.45 }} />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>Email atau NIP</label>
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@sman1contoh.sch.id"
              required
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>* Guru / piket / wali kelas / super admin</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>
          {error && <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>⚠ {error}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">{loading ? "Memproses..." : "Masuk sebagai Admin"}</button>
        </form>
        <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <Link href="/login" className="text-xs hover:underline" style={{ color: "var(--accent)" }}>← Login sebagai Siswa</Link>
        </div>
      </div>
    </div>
  );
}
