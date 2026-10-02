"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { SCHOOL_NAME } from "@/lib/branding";
import { mapGoogleErrorCode } from "@/lib/google-auth-messages";

function toStudentCredential(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

function AlertIcon() {
  return (
    <svg
      className="mt-px h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function StudentLoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const mapped = mapGoogleErrorCode(searchParams.get("error"));
    if (mapped) setError(mapped);
  }, [searchParams]);

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
    <div className="card w-full max-w-sm p-6 sm:p-8 lg:max-w-md lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      <div className="mb-6 text-center lg:text-left">
        <BrandLogo size={56} priority className="mx-auto mb-3 h-14 w-14 lg:hidden" />
        <h1 className="page-title">{SCHOOL_NAME}</h1>
        <p className="page-subtitle">Portal Laporan Pelanggaran Siswa</p>
      </div>
      <div className="divider-gold mb-6" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="text"
            inputMode="email"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="nama@siswa.sekolah.sch.id"
            required
            className="input"
          />
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            * Boleh juga isi NISN jika sudah terdaftar di akun
          </p>
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="input"
          />
        </div>
        {error && (
          <div
            className="flex items-start gap-2 rounded-[var(--radius-control)] border p-3 text-xs"
            style={{
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderColor: "color-mix(in srgb, var(--danger) 20%, transparent)",
            }}
          >
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "Memproses..." : "Masuk"}
        </button>
        <p className="text-center text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Hanya satu perangkat aktif. Login di perangkat lain akan mengeluarkan sesi sebelumnya.
        </p>
      </form>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          atau
        </span>
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      <GoogleSignInButton callbackUrl="/" disabled={loading} />
      <p className="mt-5 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Lupa password? Hubungi Admin / Super Admin
      </p>
      <div className="mt-4 border-t pt-4 text-center" style={{ borderColor: "var(--border)" }}>
        <Link
          href="/admin/login"
          className="text-xs font-medium hover:underline focus-visible:outline-none focus-visible:underline"
          style={{ color: "var(--accent)" }}
        >
          Login sebagai Guru / Admin →
        </Link>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
      style={{ background: "linear-gradient(160deg, #0f1d33 0%, var(--bg-sidebar) 55%, #091120 100%)" }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--gold) 0 1px, transparent 1px 28px)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%)" }}
      />
      <div className="relative flex items-center gap-3">
        <BrandLogo size={44} priority className="h-11 w-11" />
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">Sistem Poin Pelanggaran</span>
      </div>
      <div className="relative">
        <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
          {SCHOOL_NAME}
        </h2>
        <div className="divider-gold my-6 max-w-[12rem] opacity-70" />
        <p className="max-w-md text-sm leading-relaxed text-white/65">Portal Laporan Pelanggaran Siswa</p>
      </div>
      <div className="relative text-[11px] text-white/35">Hanya satu perangkat aktif per akun.</div>
    </aside>
  );
}

export default function StudentLoginPage() {
  return (
    <main className="min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]" style={{ background: "var(--bg-primary)" }}>
      <BrandPanel />
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 pt-10 pb-safe-bottom lg:min-h-0 lg:px-12">
        <Suspense
          fallback={
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Memuat...
            </div>
          }
        >
          <StudentLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
