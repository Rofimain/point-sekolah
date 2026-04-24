"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMAN 1 Contoh";

export function TopBar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
      className="h-14 px-5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <BrandLogo size={36} priority className="h-9 w-9" />
        <div>
          <div className="text-sm font-semibold font-serif" style={{ color: "var(--text-primary)" }}>{SCHOOL_NAME}</div>
          <div className="text-[10px] tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>Sistem Poin Pelanggaran</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 rounded-full border flex items-center justify-center text-sm transition-colors hover:opacity-80"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            title="Toggle tema">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        )}
        {session && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{session.user.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: session.user.role === "STUDENT" ? "/login" : "/admin/login" })}
              className="text-xs px-3 py-1.5 rounded border transition-colors hover:opacity-80"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
