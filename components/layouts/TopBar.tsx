"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMAN 1 Contoh";

export type AdminNavToggle = {
  open: boolean;
  onToggle: () => void;
};

export function TopBar({ adminNav }: { adminNav?: AdminNavToggle }) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header
      style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
      className="sticky top-0 z-[60] flex h-14 shrink-0 items-center justify-between gap-2 px-3 sm:px-5"
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
        <BrandLogo size={36} priority className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold font-serif" style={{ color: "var(--text-primary)" }}>
            {SCHOOL_NAME}
          </div>
          <div className="hidden text-[10px] tracking-wider text-[var(--text-muted)] sm:block uppercase">
            Sistem Poin Pelanggaran
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border text-sm transition-colors hover:opacity-80 sm:h-8 sm:w-8"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            title="Toggle tema"
            type="button"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        )}
        {session && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden max-w-[8rem] truncate text-xs sm:inline md:max-w-[12rem]" style={{ color: "var(--text-muted)" }}>
              {session.user.name}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: session.user.role === "STUDENT" ? "/login" : "/admin/login" })}
              className="touch-manipulation rounded border px-2.5 py-2 text-[11px] transition-colors hover:opacity-80 sm:px-3 sm:py-1.5 sm:text-xs"
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
