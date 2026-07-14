"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMAN 1 Contoh";

function toStudentCredential(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

export default function StudentLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("student-login", {
      email: toStudentCredential(identifier),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      window.location.assign("/form");
    }
  }

  return (
    <div
      className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center px-4 pt-10 pb-safe-bottom"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-sm rounded-2xl border p-5 sm:p-8" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="text-center mb-6">
          <BrandLogo size={56} priority className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-base font-semibold font-serif" style={{ color: "var(--text-primary)" }}>{SCHOOL_NAME}</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Portal Laporan Pelanggaran Siswa</p>
        </div>
        <div className="h-px mb-6" style={{ background: "var(--border)" }} />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>NISN</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="0051234567"
              required
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>* Boleh juga isi email siswa jika ada</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>
          {error && <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>⚠ {error}</div>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60" style={{ background: "var(--accent)" }}>{loading ? "Memproses..." : "Masuk"}</button>
        </form>
        <p className="text-center text-xs mt-5" style={{ color: "var(--text-muted)" }}>Lupa password? Hubungi wali kelas atau TU</p>
        <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <Link href="/admin/login" className="text-xs hover:underline" style={{ color: "var(--accent)" }}>Login sebagai Guru / Admin →</Link>
        </div>
      </div>
    </div>
  );
}
