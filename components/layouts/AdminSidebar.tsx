"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn, getRoleLabel } from "@/lib/utils";
import { canManageData, canManageUsers, isSuperAdmin } from "@/lib/staff-roles";

export type SidebarClass = { id: string; name: string; grade: string };

const ROLE_LINKS = [
  { href: "/users", label: "Semua", roleKey: "" },
  { href: "/users?role=STUDENT", label: "Siswa", roleKey: "STUDENT" },
  { href: "/users?role=TEACHER", label: "Guru", roleKey: "TEACHER" },
  { href: "/users?role=ADMIN", label: "Admin", roleKey: "ADMIN" },
  { href: "/users?role=SUPER_ADMIN", label: "Super Admin", roleKey: "SUPER_ADMIN" },
];

function IconBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors duration-200",
        "bg-white/[0.08] group-[.is-active]:bg-white/[0.12]",
        className
      )}
    >
      {children}
    </span>
  );
}

function ChevronToggle({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]", open && "rotate-180", className)}
    >
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 px-2">
      <span className="font-serif text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" aria-hidden />
    </div>
  );
}

function SubmenuLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block touch-manipulation rounded-lg px-2.5 py-2.5 font-serif text-[11px] leading-snug outline-none transition-all duration-200 ease-out",
        "hover:bg-white/[0.07] hover:pl-3 motion-safe:hover:translate-x-[1px]",
        "focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-0",
        active
          ? "bg-white/[0.1] font-medium text-white shadow-[inset_3px_0_0_var(--gold)]"
          : "text-white/75 hover:text-white"
      )}
    >
      {children}
    </Link>
  );
}

function SimpleNavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group mb-1 flex touch-manipulation items-center gap-2.5 rounded-xl px-2.5 py-2.5 font-serif outline-none transition-all duration-200 ease-out",
        "hover:bg-[var(--bg-sidebar-hover)] motion-safe:active:scale-[0.99]",
        "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]",
        active && "is-active bg-[var(--bg-sidebar-active)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        !active && "text-white/75 hover:text-white/95"
      )}
    >
      <IconBox>{icon}</IconBox>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-tight">{label}</span>
    </Link>
  );
}

function SplitNavRow({
  href,
  active,
  open,
  onToggle,
  icon,
  label,
  ariaToggle,
  children,
}: {
  href: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  ariaToggle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div
        className={cn(
          "group flex overflow-hidden rounded-xl transition-all duration-200 ease-out",
          "ring-1 ring-transparent hover:ring-white/[0.06]",
          active
            ? "is-active bg-[var(--bg-sidebar-active)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-white/[0.08]"
            : "text-white/75 hover:bg-[var(--bg-sidebar-hover)] hover:text-white/95"
        )}
      >
        <Link
          href={href}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-2.5 pr-1 font-serif outline-none transition-colors duration-200",
            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25"
          )}
        >
          <IconBox>{icon}</IconBox>
          <span className="truncate text-[12px] font-semibold tracking-tight">{label}</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-label={ariaToggle}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "flex w-10 shrink-0 touch-manipulation items-center justify-center border-l border-white/[0.08] text-white/80 outline-none transition-all duration-200",
            "hover:bg-black/15 hover:text-white active:bg-black/25 motion-safe:active:scale-[0.94]",
            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
          )}
        >
          <ChevronToggle open={open} className="opacity-90" />
        </button>
      </div>
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "pointer-events-auto mt-1.5 max-h-[18rem] opacity-100" : "pointer-events-none max-h-0 opacity-0"
        )}
      >
        <div className="ml-1.5 max-h-[14rem] space-y-0.5 overflow-y-auto overflow-x-hidden border-l border-white/[0.07] py-0.5 pl-2.5 pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar({ classes }: { classes: SidebarClass[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const canManage = canManageData(session?.user?.role);
  const canUsers = canManageUsers(session?.user?.role);
  const superAdmin = isSuperAdmin(session?.user?.role);

  const [openMenu, setOpenMenu] = useState<null | "records" | "students" | "users" | "settings">(null);

  const classId = searchParams.get("classId") || "";
  const roleFilter = searchParams.get("role") || "";

  useEffect(() => {
    if (pathname.startsWith("/records")) setOpenMenu("records");
    else if (pathname.startsWith("/students") && !pathname.includes("/cetak")) setOpenMenu("students");
    else if (pathname.startsWith("/users")) setOpenMenu("users");
    else if (pathname.startsWith("/settings")) setOpenMenu("settings");
    else setOpenMenu(null);
  }, [pathname]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden font-serif">
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 sm:py-5">
        <div className="px-3 pb-2">
          <SectionLabel>Utama</SectionLabel>

          <SimpleNavLink
            href="/dashboard"
            active={pathname === "/dashboard"}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
              </svg>
            }
            label="Dashboard"
          />

          <SimpleNavLink
            href="/notifications"
            active={pathname.startsWith("/notifications")}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Notifikasi"
          />

          <SplitNavRow
            href="/records"
            active={pathname.startsWith("/records")}
            open={openMenu === "records"}
            onToggle={() => setOpenMenu((m) => (m === "records" ? null : "records"))}
            ariaToggle="Buka daftar kelas — Catatan Siswa"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
              </svg>
            }
            label="Catatan Siswa"
          >
            <SubmenuLink href="/records" active={!classId && pathname.startsWith("/records")}>
              Semua kelas
            </SubmenuLink>
            {classes.map((c) => (
              <SubmenuLink
                key={c.id}
                href={`/records?classId=${c.id}`}
                active={classId === c.id && pathname.startsWith("/records")}
              >
                {c.name.trim() || c.grade || "—"}
              </SubmenuLink>
            ))}
          </SplitNavRow>

          <SplitNavRow
            href="/students"
            active={pathname.startsWith("/students") && !pathname.includes("/cetak")}
            open={openMenu === "students"}
            onToggle={() => setOpenMenu((m) => (m === "students" ? null : "students"))}
            ariaToggle="Buka daftar kelas — Data Siswa"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
              </svg>
            }
            label="Data Siswa"
          >
            <SubmenuLink href="/students" active={!classId && pathname.startsWith("/students") && !pathname.includes("/cetak")}>
              Semua kelas
            </SubmenuLink>
            {classes.map((c) => (
              <SubmenuLink
                key={c.id}
                href={`/students?classId=${c.id}`}
                active={classId === c.id && pathname.startsWith("/students") && !pathname.includes("/cetak")}
              >
                {c.name.trim() || c.grade || "—"}
              </SubmenuLink>
            ))}
          </SplitNavRow>

          <SimpleNavLink
            href="/cetak-surat"
            active={pathname.startsWith("/cetak-surat") || (pathname.includes("/students/") && pathname.includes("/cetak"))}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" strokeLinecap="round" />
                <path d="M6 14h12v8H6z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Cetak surat"
          />
        </div>

        <div className="px-3 pb-2 pt-2">
          <SectionLabel>Pengaturan</SectionLabel>

          {canManage && (
            <SplitNavRow
              href="/settings"
              active={pathname.startsWith("/settings")}
              open={openMenu === "settings"}
              onToggle={() => setOpenMenu((m) => (m === "settings" ? null : "settings"))}
              ariaToggle="Buka submenu — Pengaturan sekolah"
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                    strokeLinecap="round"
                  />
                </svg>
              }
              label="Pengaturan sekolah"
            >
              <SubmenuLink href="/settings" active={pathname === "/settings"}>
                Umum
              </SubmenuLink>
              <SubmenuLink href="/settings/remisi" active={pathname.startsWith("/settings/remisi")}>
                Poin Remisi &amp; Reward
              </SubmenuLink>
              <SubmenuLink href="/settings/redaksi" active={pathname.startsWith("/settings/redaksi")}>
                Redaksi cetak
              </SubmenuLink>
            </SplitNavRow>
          )}

          {superAdmin && (
            <SimpleNavLink
              href="/access-log"
              active={pathname.startsWith("/access-log")}
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              label="Log akses"
            />
          )}

          <SimpleNavLink
            href="/violations"
            active={pathname.startsWith("/violations")}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Jenis Pelanggaran"
          />

          {canUsers && (
            <SplitNavRow
              href="/users"
              active={pathname.startsWith("/users")}
              open={openMenu === "users"}
              onToggle={() => setOpenMenu((m) => (m === "users" ? null : "users"))}
              ariaToggle="Buka filter role — Manajemen User"
              icon={
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
                </svg>
              }
              label="Manajemen User"
            >
              {ROLE_LINKS.map((r) => (
                <SubmenuLink
                  key={r.href}
                  href={r.href}
                  active={pathname.startsWith("/users") && (r.roleKey === "" ? !roleFilter : roleFilter === r.roleKey)}
                >
                  {r.label}
                </SubmenuLink>
              ))}
            </SplitNavRow>
          )}
        </div>

        {canManage && <div className="px-3 pb-2 pt-2">
          <SectionLabel>Laporan</SectionLabel>
          <SimpleNavLink
            href="/export"
            active={pathname.startsWith("/export")}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Export Excel"
          />
        </div>}
      </nav>

      <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div
          className="rounded-xl border border-white/[0.07] px-3 py-2.5 transition-colors duration-200 hover:border-white/12"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(184,149,108,0.08))",
          }}
        >
          <div className="truncate text-[11px] font-semibold tracking-tight text-white/85">
            {session?.user?.name}
          </div>
          <div className="mt-0.5 text-[10px] font-medium tracking-wide" style={{ color: "var(--gold)" }}>
            {session?.user?.role ? getRoleLabel(session.user.role) : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
