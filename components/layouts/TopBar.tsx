"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BrandLogo } from "@/components/BrandLogo";
import UserAvatar from "@/components/ui/UserAvatar";
import Link from "next/link";
import { SCHOOL_NAME } from "@/lib/branding";
import { getRoleLabel } from "@/lib/utils";
import { Z_INDEX } from "@/lib/ui-layers";
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [accountPos, setAccountPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!accountOpen) return;
    function place() {
      const rect = accountBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAccountPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    }
    place();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (accountMenuRef.current?.contains(target) || accountBtnRef.current?.contains(target)) return;
      setAccountOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", place);
    const focusId = window.requestAnimationFrame(() => {
      accountMenuRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", place);
      window.cancelAnimationFrame(focusId);
    };
  }, [accountOpen]);

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
              className="btn-icon shrink-0 touch-manipulation lg:hidden"
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
            <BrandLogo variant="seal" size={36} priority />
          </Link>
          <span className="hidden h-7 w-px shrink-0 sm:block" style={{ background: "var(--border)" }} aria-hidden />
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-serif text-[16px] font-semibold leading-tight tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {SCHOOL_NAME}
            </div>
            <div
              className="hidden text-[10px] font-medium uppercase tracking-[0.2em] sm:block"
              style={{ color: "var(--gold)" }}
            >
              SISTEM POIN PELANGGARAN
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {staffNotifications}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn-icon touch-manipulation"
              title="Toggle tema"
              type="button"
              aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
            >
              <span className="relative h-4 w-4">
                <svg
                  className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${theme === "dark" ? "rotate-0 opacity-100" : "rotate-90 opacity-0"}`}
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
                <svg
                  className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${theme === "dark" ? "-rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
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
              </span>
            </button>
          )}
          {session ? (
            <>
              <span className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} aria-hidden />
              <button
                ref={accountBtnRef}
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border py-0 pl-1 pr-2.5 transition-colors duration-150 hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Menu akun"
                onClick={() => setAccountOpen((open) => !open)}
              >
                <UserAvatar name={session.user.name ?? ""} size="sm" className="!h-7 !w-7" />
                <span className="hidden max-w-[10rem] truncate text-[13px] font-medium sm:inline">{session.user.name}</span>
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      </header>
      {session && accountOpen && accountPos && mounted
        ? createPortal(
            <div
              ref={accountMenuRef}
              role="menu"
              className="card menu-pop w-64 overflow-hidden p-1.5"
              style={{
                position: "fixed",
                top: accountPos.top,
                right: accountPos.right,
                zIndex: Z_INDEX.dropdown,
                borderRadius: 14,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="px-2.5 py-2">
                <div className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {session.user.name}
                </div>
                <span
                  className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                >
                  {getRoleLabel(session.user.role)}
                </span>
              </div>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                style={{ color: "var(--text-primary)" }}
                onClick={() => {
                  setAccountOpen(false);
                  setPasswordOpen(true);
                }}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
                </svg>
                Ubah password
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={revokingSessions}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:opacity-60"
                style={{ color: "var(--text-primary)" }}
                onClick={() => void revokeAllSessions()}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <rect x="3" y="5" width="14" height="12" rx="2" />
                  <path d="M17 9h3a1 1 0 011 1v4a1 1 0 01-1 1h-3M8 9v4" strokeLinecap="round" />
                </svg>
                {revokingSessions ? "Memproses…" : "Keluar dari semua perangkat"}
              </button>
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                style={{ color: "var(--danger)" }}
                onClick={() => {
                  setAccountOpen(false);
                  void signOut({ callbackUrl: session.user.role === "STUDENT" ? "/login" : "/admin/login" });
                }}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Keluar
              </button>
            </div>,
            document.body
          )
        : null}
      {session && passwordOpen ? (
        <ChangePasswordDialog role={session.user.role} onClose={() => setPasswordOpen(false)} />
      ) : null}
    </>
  );
}
