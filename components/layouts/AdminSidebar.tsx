"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export type SidebarClass = { id: string; name: string; grade: string };

const ROLE_LINKS = [
  { href: "/users", label: "Semua", roleKey: "" },
  { href: "/users?role=STUDENT", label: "Siswa", roleKey: "STUDENT" },
  { href: "/users?role=TEACHER", label: "Guru", roleKey: "TEACHER" },
  { href: "/users?role=SUPER_ADMIN", label: "Super Admin", roleKey: "SUPER_ADMIN" },
];

export function AdminSidebar({ classes }: { classes: SidebarClass[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [openMenu, setOpenMenu] = useState<null | "records" | "students" | "users">(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const classId = searchParams.get("classId") || "";
  const roleFilter = searchParams.get("role") || "";

  useEffect(() => {
    if (pathname.startsWith("/records")) setOpenMenu("records");
    else if (pathname.startsWith("/students")) setOpenMenu("students");
    else if (pathname.startsWith("/users")) setOpenMenu("users");
    else setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!sidebarRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function subLinkStyle(active: boolean) {
    return {
      display: "block" as const,
      padding: "6px 10px 6px 12px",
      marginBottom: 2,
      borderRadius: 6,
      fontSize: 11,
      borderLeft: active ? "2px solid rgba(255,255,255,0.85)" : "2px solid transparent",
      color: active ? "rgba(255,255,255,0.95)" : "rgba(200,208,230,0.75)",
      background: active ? "rgba(255,255,255,0.08)" : "transparent",
    };
  }

  return (
    <aside
      ref={sidebarRef}
      className="w-52 flex-shrink-0 flex flex-col"
      style={{ background: "var(--bg-sidebar)" }}
    >
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-5">
          <div className="text-[9px] tracking-[1.5px] uppercase px-2 mb-1.5" style={{ color: "var(--text-muted)" }}>
            Utama
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 transition-colors"
            style={{
              background: pathname === "/dashboard" ? "var(--bg-sidebar-active)" : "transparent",
              color: pathname === "/dashboard" ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
            }}
            onMouseEnter={(e) => {
              if (pathname !== "/dashboard") (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)";
            }}
            onMouseLeave={(e) => {
              if (pathname !== "/dashboard") (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span className="w-4 h-4 rounded flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
              ◉
            </span>
            <span className="text-[12px]">Dashboard</span>
          </Link>

          {/* Catatan Siswa + kelas */}
          <div className="mb-0.5">
            <div
              className="flex items-stretch rounded-lg overflow-hidden"
              style={{
                background: pathname.startsWith("/records") ? "var(--bg-sidebar-active)" : "transparent",
              }}
            >
              <Link
                href="/records"
                className="flex flex-1 items-center gap-2.5 px-3 py-2.5 min-w-0 transition-colors"
                style={{
                  color: pathname.startsWith("/records") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                }}
                onMouseEnter={(e) => {
                  if (!pathname.startsWith("/records")) (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!pathname.startsWith("/records")) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                  ≡
                </span>
                <span className="text-[12px] truncate">Catatan Siswa</span>
              </Link>
              <button
                type="button"
                aria-label="Menu kelas"
                className="px-2 flex items-center shrink-0 border-l border-white/10"
                style={{
                  color: pathname.startsWith("/records") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                  background: "transparent",
                }}
                onClick={() => setOpenMenu((m) => (m === "records" ? null : "records"))}
              >
                <span className="text-[9px] opacity-80">{openMenu === "records" ? "▾" : "▸"}</span>
              </button>
            </div>
            {openMenu === "records" && (
              <div className="mt-1 ml-1 pl-2 border-l border-white/10 max-h-52 overflow-y-auto">
                <Link href="/records" style={subLinkStyle(!classId && pathname.startsWith("/records"))} onClick={() => setOpenMenu(null)}>
                  Semua kelas
                </Link>
                {classes.map((c) => {
                  const active = classId === c.id && pathname.startsWith("/records");
                  return (
                    <Link
                      key={c.id}
                      href={`/records?classId=${c.id}`}
                      style={subLinkStyle(active)}
                      onClick={() => setOpenMenu(null)}
                    >
                      {c.grade} {c.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Data Siswa + kelas */}
          <div className="mb-0.5">
            <div
              className="flex items-stretch rounded-lg overflow-hidden"
              style={{
                background: pathname.startsWith("/students") ? "var(--bg-sidebar-active)" : "transparent",
              }}
            >
              <Link
                href="/students"
                className="flex flex-1 items-center gap-2.5 px-3 py-2.5 min-w-0 transition-colors"
                style={{
                  color: pathname.startsWith("/students") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                }}
                onMouseEnter={(e) => {
                  if (!pathname.startsWith("/students")) (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!pathname.startsWith("/students")) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                  ▣
                </span>
                <span className="text-[12px] truncate">Data Siswa</span>
              </Link>
              <button
                type="button"
                aria-label="Menu kelas"
                className="px-2 flex items-center shrink-0 border-l border-white/10"
                style={{
                  color: pathname.startsWith("/students") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                  background: "transparent",
                }}
                onClick={() => setOpenMenu((m) => (m === "students" ? null : "students"))}
              >
                <span className="text-[9px] opacity-80">{openMenu === "students" ? "▾" : "▸"}</span>
              </button>
            </div>
            {openMenu === "students" && (
              <div className="mt-1 ml-1 pl-2 border-l border-white/10 max-h-52 overflow-y-auto">
                <Link href="/students" style={subLinkStyle(!classId && pathname.startsWith("/students"))} onClick={() => setOpenMenu(null)}>
                  Semua kelas
                </Link>
                {classes.map((c) => {
                  const active = classId === c.id && pathname.startsWith("/students");
                  return (
                    <Link
                      key={c.id}
                      href={`/students?classId=${c.id}`}
                      style={subLinkStyle(active)}
                      onClick={() => setOpenMenu(null)}
                    >
                      {c.grade} {c.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-3 mb-5">
          <div className="text-[9px] tracking-[1.5px] uppercase px-2 mb-1.5" style={{ color: "var(--text-muted)" }}>
            Pengaturan
          </div>
          <Link
            href="/violations"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 transition-colors"
            style={{
              background: pathname.startsWith("/violations") ? "var(--bg-sidebar-active)" : "transparent",
              color: pathname.startsWith("/violations") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/violations")) (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)";
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/violations")) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span className="w-4 h-4 rounded flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
              ◈
            </span>
            <span className="text-[12px]">Jenis Pelanggaran</span>
          </Link>

          {isSuperAdmin && (
            <div className="mb-0.5">
              <div
                className="flex items-stretch rounded-lg overflow-hidden"
                style={{
                  background: pathname.startsWith("/users") ? "var(--bg-sidebar-active)" : "transparent",
                }}
              >
                <Link
                  href="/users"
                  className="flex flex-1 items-center gap-2.5 px-3 py-2.5 min-w-0 transition-colors"
                  style={{
                    color: pathname.startsWith("/users") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                  }}
                  onMouseEnter={(e) => {
                    if (!pathname.startsWith("/users")) (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!pathname.startsWith("/users")) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                    ◎
                  </span>
                  <span className="text-[12px] truncate">Manajemen User</span>
                </Link>
                <button
                  type="button"
                  aria-label="Menu role"
                  className="px-2 flex items-center shrink-0 border-l border-white/10"
                  style={{
                    color: pathname.startsWith("/users") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                    background: "transparent",
                  }}
                  onClick={() => setOpenMenu((m) => (m === "users" ? null : "users"))}
                >
                  <span className="text-[9px] opacity-80">{openMenu === "users" ? "▾" : "▸"}</span>
                </button>
              </div>
              {openMenu === "users" && (
                <div className="mt-1 ml-1 pl-2 border-l border-white/10">
                  {ROLE_LINKS.map((r) => {
                    const active =
                      pathname.startsWith("/users") &&
                      (r.roleKey === "" ? !roleFilter : roleFilter === r.roleKey);
                    return (
                      <Link key={r.href} href={r.href} style={subLinkStyle(active)} onClick={() => setOpenMenu(null)}>
                        {r.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-3 mb-5">
          <div className="text-[9px] tracking-[1.5px] uppercase px-2 mb-1.5" style={{ color: "var(--text-muted)" }}>
            Laporan
          </div>
          <Link
            href="/export"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 transition-colors"
            style={{
              background: pathname.startsWith("/export") ? "var(--bg-sidebar-active)" : "transparent",
              color: pathname.startsWith("/export") ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/export")) (e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)";
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/export")) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span className="w-4 h-4 rounded flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>
              ↓
            </span>
            <span className="text-[12px]">Export Excel</span>
          </Link>
        </div>
      </nav>

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
