"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMAN 1 Contoh";
const STAFF_DOMAIN = process.env.NEXT_PUBLIC_STAFF_DOMAIN || "sman1contoh.sch.id";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const result = await signIn("admin-login", { email: email.trim().toLowerCase(), password, redirect: false });
    setLoading(false);
    if (result?.error) { setError(result.error); } else { router.push("/dashboard"); router.refresh(); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-8" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="text-center mb-6">
          <BrandLogo size={56} priority className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-base font-semibold font-serif" style={{ color: "var(--text-primary)" }}>Portal Admin — Guru & Staff</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{SCHOOL_NAME} · Sistem Poin Pelanggaran</p>
        </div>
        <div className="h-px mb-6" style={{ background: "var(--border)" }} />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>Email Institusi</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`nama.guru@${STAFF_DOMAIN}`} required className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>* Domain @{STAFF_DOMAIN} (guru / staff)</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--text-secondary)" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full px-3 py-2.5 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>
          {error && <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>⚠ {error}</div>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60" style={{ background: "#1A2340" }}>{loading ? "Memproses..." : "Masuk sebagai Admin"}</button>
        </form>
        <div className="flex justify-center mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <span style={{ color: "var(--success)", fontSize: 10 }}>■</span> Super Admin memiliki akses penuh
          </span>
        </div>
        <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <Link href="/login" className="text-xs hover:underline" style={{ color: "var(--accent)" }}>← Login sebagai Siswa</Link>
        </div>
      </div>
    </div>
  );
}
