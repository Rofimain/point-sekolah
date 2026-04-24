"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◉", section: "Utama" },
  { href: "/records", label: "Catatan Siswa", icon: "≡", section: "Utama" },
  { href: "/students", label: "Data Siswa", icon: "▣", section: "Utama" },
  { href: "/violations", label: "Jenis Pelanggaran", icon: "◈", section: "Pengaturan" },
  { href: "/users", label: "Manajemen User", icon: "◎", section: "Pengaturan", adminOnly: true },
  { href: "/export", label: "Export Excel", icon: "↓", section: "Laporan" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const sections = ["Utama", "Pengaturan", "Laporan"];

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col" style={{ background: "var(--bg-sidebar)" }}>
      <nav className="flex-1 py-4 overflow-y-auto">
        {sections.map((section) => {
          const items = navItems.filter(
            (i) => i.section === section && (!i.adminOnly || isSuperAdmin)
          );
          if (items.length === 0) return null;
          return (
            <div key={section} className="px-3 mb-5">
              <div className="text-[9px] tracking-[1.5px] uppercase px-2 mb-1.5"
                style={{ color: "var(--text-muted)" }}>
                {section}
              </div>
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 transition-colors"
                    style={{
                      background: active ? "var(--bg-sidebar-active)" : "transparent",
                      color: active ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[10px]"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      {item.icon}
                    </span>
                    <span className="text-[12px]">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            {session?.user?.name}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {session?.user?.role === "SUPER_ADMIN" ? "Super Admin" : "Guru"}
          </div>
        </div>
      </div>
    </aside>
  );
}
