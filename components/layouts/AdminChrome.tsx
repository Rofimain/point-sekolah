"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/layouts/TopBar";
import { AdminSidebar, type SidebarClass } from "@/components/layouts/AdminSidebar";
import { StaffSubmissionBell } from "@/components/staff/StaffSubmissionBell";
import { cn } from "@/lib/utils";

function SidebarSkeleton() {
  return <div className="h-full min-h-[120px] w-full animate-pulse bg-white/5" aria-hidden />;
}

export default function AdminChrome({
  sidebarClasses,
  children,
}: {
  sidebarClasses: SidebarClass[];
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col" style={{ background: "transparent" }}>
      <TopBar
        adminNav={{ open: navOpen, onToggle: () => setNavOpen((v) => !v) }}
        staffNotifications={<StaffSubmissionBell />}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden" style={{ height: "calc(100dvh - 3.5rem)", maxHeight: "calc(100vh - 3.5rem)" }}>
        {navOpen ? (
          <button
            type="button"
            id="admin-nav-backdrop"
            className="fixed inset-0 top-14 z-40 cursor-default bg-black/40 backdrop-blur-[2px] lg:hidden"
            aria-label="Tutup menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <div
          id="admin-sidebar-panel"
          className={cn(
            "fixed bottom-0 left-0 top-14 z-50 flex w-[min(18.5rem,92vw)] flex-col border-r transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:top-auto lg:z-auto lg:h-auto lg:w-60 lg:shrink-0 lg:translate-x-0",
            "lg:transition-none",
            navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--bg-sidebar) 100%, #1a3a4a 8%) 0%, var(--bg-sidebar) 42%, #080f1a 100%)",
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "4px 0 32px rgba(0,0,0,0.18)",
          }}
        >
          <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80"
              style={{
                background: "linear-gradient(180deg, color-mix(in srgb, var(--gold) 12%, transparent), transparent)",
              }}
              aria-hidden
            />
            <Suspense fallback={<SidebarSkeleton />}>
              <AdminSidebar classes={sidebarClasses} />
            </Suspense>
          </div>
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-pb-safe-bottom px-3 pt-5 pb-safe-bottom motion-safe:animate-fade-up sm:px-6 sm:pt-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
