"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SidebarClass = { id: string; name: string; grade: string };

const ROLE_LINKS = [
  { href: "/users", label: "Semua", roleKey: "" },
  { href: "/users?role=STUDENT", label: "Siswa", roleKey: "STUDENT" },
  { href: "/users?role=TEACHER", label: "Guru", roleKey: "TEACHER" },
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
    <div className="mb-2 px-2 font-serif text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
      {children}
    </div>
  );
}

function SubmenuLink({
  href,
  active,
  onPick,
  children,
}: {
  href: string;
  active: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className={cn(
        "block rounded-lg px-2.5 py-2 font-serif text-[11px] leading-snug outline-none transition-all duration-200 ease-out",
        "hover:bg-white/[0.07] hover:pl-3 motion-safe:hover:translate-x-[1px]",
        "focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-0",
        active
          ? "bg-white/[0.12] font-medium text-white shadow-[inset_3px_0_0_rgba(255,255,255,0.55)]"
          : "text-white/80 hover:text-white"
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
        "group mb-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2 font-serif outline-none transition-all duration-200 ease-out",
        "hover:bg-[var(--bg-sidebar-hover)] motion-safe:active:scale-[0.99]",
        "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-sidebar)]",
        active && "is-active bg-[var(--bg-sidebar-active)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        !active && "text-white/75 hover:text-white/95"
      )}
    >
      <IconBox>{icon}</IconBox>
      <span className="truncate text-[12px] font-semibold tracking-tight">{label}</span>
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
            "flex w-10 shrink-0 items-center justify-center border-l border-white/[0.08] text-white/80 outline-none transition-all duration-200",
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
          open ? "pointer-events-auto mt-1.5 max-h-[15rem] opacity-100" : "pointer-events-none max-h-0 opacity-0"
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
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [openMenu, setOpenMenu] = useState<null | "records" | "students" | "users">(null);

  const classId = searchParams.get("classId") || "";
  const roleFilter = searchParams.get("role") || "";

  useEffect(() => {
    if (pathname.startsWith("/records")) setOpenMenu("records");
    else if (pathname.startsWith("/students")) setOpenMenu("students");
    else if (pathname.startsWith("/users")) setOpenMenu("users");
    else setOpenMenu(null);
  }, [pathname]);

  const closeSub = () => setOpenMenu(null);

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r font-serif"
      style={{ background: "var(--bg-sidebar)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <nav className="flex-1 overflow-y-auto py-5">
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
            <SubmenuLink href="/records" active={!classId && pathname.startsWith("/records")} onPick={closeSub}>
              Semua kelas
            </SubmenuLink>
            {classes.map((c) => (
              <SubmenuLink
                key={c.id}
                href={`/records?classId=${c.id}`}
                active={classId === c.id && pathname.startsWith("/records")}
                onPick={closeSub}
              >
                {c.grade} {c.name}
              </SubmenuLink>
            ))}
          </SplitNavRow>

          <SplitNavRow
            href="/students"
            active={pathname.startsWith("/students")}
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
            <SubmenuLink href="/students" active={!classId && pathname.startsWith("/students")} onPick={closeSub}>
              Semua kelas
            </SubmenuLink>
            {classes.map((c) => (
              <SubmenuLink
                key={c.id}
                href={`/students?classId=${c.id}`}
                active={classId === c.id && pathname.startsWith("/students")}
                onPick={closeSub}
              >
                {c.grade} {c.name}
              </SubmenuLink>
            ))}
          </SplitNavRow>
        </div>

        <div className="px-3 pb-2 pt-2">
          <SectionLabel>Pengaturan</SectionLabel>

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

          {isSuperAdmin && (
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
                  onPick={closeSub}
                >
                  {r.label}
                </SubmenuLink>
              ))}
            </SplitNavRow>
          )}
        </div>

        <div className="px-3 pb-2 pt-2">
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
        </div>
      </nav>

      <div className="border-t p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div
          className="rounded-xl border border-white/[0.06] bg-white/[0.05] px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-colors duration-200 hover:bg-white/[0.07]"
        >
          <div className="truncate text-[11px] font-semibold text-white/75">
            {session?.user?.name}
          </div>
          <div className="mt-0.5 text-[10px] text-white/40">
            {session?.user?.role === "SUPER_ADMIN" ? "Super Admin" : "Guru"}
          </div>
        </div>
      </div>
    </aside>
  );
}
