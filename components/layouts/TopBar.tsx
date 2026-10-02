"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import Link from "next/link";
import { SCHOOL_NAME } from "@/lib/branding";
import { ChangePasswordDialog } from "@/components/account/ChangePasswordDialog";

export type AdminNavToggle = {
  open: boolean;
  onToggle: () => void;
};

export function TopBar({
  adminNav,
  staffNotifications,
}: {
  adminNav?: AdminNavToggle;
  /** Lonceng laporan siswa (hanya layout admin). */
  staffNotifications?: ReactNode;
}) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  useEffect(() => setMounted(true), []);

  async function revokeAllSessions() {
    if (!session || revokingSessions) return;
    const ok = window.confirm("Keluar dari semua perangkat? Anda perlu login ulang di sini juga.");
    if (!ok) return;
    setRevokingSessions(true);
    try {
      const response = await fetch("/api/account/sessions/revoke", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Gagal");
      await signOut({ callbackUrl: session.user.role === "STUDENT" ? "/login" : "/admin/login" });
    } catch {
      setRevokingSessions(false);
      window.alert("Gagal mengeluarkan sesi. Coba lagi.");
    }
  }

  return (
    <>
      <header
        /* z-[60] = Z_INDEX.topBar — lihat lib/ui-layers.ts */
        className="no-print print-hide sticky top-0 z-[60] flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 backdrop-blur-md sm:px-5"
        style={{
          background: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {adminNav ? (
            <button
              type="button"
              className="btn btn-ghost h-9 w-9 shrink-0 touch-manipulation rounded-full p-0 lg:hidden"
              style={{ color: "var(--text-primary)" }}
              aria-label={adminNav.open ? "Tutup menu navigasi" : "Buka menu navigasi"}
              aria-expanded={adminNav.open}
              aria-controls="admin-sidebar-panel"
              onClick={adminNav.onToggle}
            >
              {adminNav.open ? (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ) : null}
          <Link
            href={session?.user.role === "STUDENT" ? "/form" : "/dashboard"}
            className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label={session?.user.role === "STUDENT" ? "Kembali ke portal siswa" : "Kembali ke dashboard"}
          >
            <BrandLogo size={34} priority className="h-[34px] w-[34px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-serif text-[15px] font-semibold leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {SCHOOL_NAME}
            </div>
            <div
              className="hidden text-[11px] font-medium tracking-[0.08em] sm:block"
              style={{ color: "var(--text-muted)" }}
            >
              Sistem Poin Pelanggaran
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {staffNotifications}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn btn-ghost h-9 w-9 touch-manipulation rounded-full p-0"
              title="Toggle tema"
              type="button"
              aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
            >
              {theme === "dark" ? (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="4" />
                  <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden
                >
                  <path
                    d="M21 14.5A8.5 8.5 0 1111.5 3a7 7 0 009.5 11.5z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          )}
          {session && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span
                className="mx-1 hidden h-5 w-px sm:block"
                style={{ background: "var(--border)" }}
                aria-hidden
              />
              <span
                className="hidden max-w-[8rem] truncate pr-1 text-xs font-medium sm:inline md:max-w-[12rem]"
                style={{ color: "var(--text-secondary)" }}
              >
                {session.user.name}
              </span>
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="btn btn-ghost btn-sm h-9 w-9 touch-manipulation rounded-full p-0 sm:w-auto sm:rounded-[var(--radius-control)] sm:px-3"
                title="Ubah password akun"
                aria-label="Ubah password"
              >
                <svg
                  className="h-4 w-4 sm:hidden"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
                </svg>
                <span className="sr-only sm:not-sr-only">Password</span>
              </button>
              <button
                type="button"
                onClick={() => void revokeAllSessions()}
                disabled={revokingSessions}
                className="btn btn-ghost btn-sm hidden h-9 touch-manipulation sm:inline-flex"
                title="Keluar dari semua perangkat"
                aria-label="Keluar semua perangkat"
              >
                {revokingSessions ? "..." : "Semua sesi"}
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: session.user.role === "STUDENT" ? "/login" : "/admin/login" })}
                className="btn btn-secondary btn-sm h-9 w-9 touch-manipulation rounded-full p-0 sm:w-auto sm:rounded-[var(--radius-control)] sm:px-3"
                title="Keluar"
                aria-label="Keluar"
              >
                <svg
                  className="h-4 w-4 sm:hidden"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only sm:not-sr-only">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>
      {session && passwordOpen ? (
        <ChangePasswordDialog role={session.user.role} onClose={() => setPasswordOpen(false)} />
      ) : null}
    </>
  );
}
