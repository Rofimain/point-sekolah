"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMAN 1 Contoh";

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

  useEffect(() => setMounted(true), []);

  return (
    <header
      className="sticky top-0 z-[60] flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-5"
      style={{
        background: "color-mix(in srgb, var(--bg-secondary) 92%, transparent)",
        borderColor: "var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 color-mix(in srgb, var(--gold) 22%, transparent)",
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {adminNav ? (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border transition-opacity hover:opacity-90 lg:hidden"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            aria-expanded={adminNav.open}
            aria-controls="admin-sidebar-panel"
            onClick={adminNav.onToggle}
          >
            {adminNav.open ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        ) : null}
        <div className="relative shrink-0">
          <BrandLogo size={36} priority className="h-9 w-9" />
          <span
            className="pointer-events-none absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-sm"
            style={{ background: "var(--gold)" }}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-[15px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
            {SCHOOL_NAME}
          </div>
          <div className="hidden text-[10px] font-medium uppercase tracking-[0.16em] sm:block" style={{ color: "var(--text-muted)" }}>
            Sistem Poin Pelanggaran
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {staffNotifications}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg border text-sm transition-colors hover:opacity-80 sm:h-8 sm:w-8"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            title="Toggle tema"
            type="button"
          >
            {theme === "dark" ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M21 14.5A8.5 8.5 0 1111.5 3a7 7 0 009.5 11.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
        {session && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden max-w-[8rem] truncate text-xs font-medium sm:inline md:max-w-[12rem]" style={{ color: "var(--text-secondary)" }}>
              {session.user.name}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: session.user.role === "STUDENT" ? "/login" : "/admin/login" })}
              className="touch-manipulation rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors hover:opacity-80 sm:px-3 sm:py-1.5 sm:text-xs"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
