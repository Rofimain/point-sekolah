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
    <div className="flex min-h-screen min-h-[100dvh] flex-col" style={{ background: "var(--bg-primary)" }}>
      <TopBar
        adminNav={{ open: navOpen, onToggle: () => setNavOpen((v) => !v) }}
        staffNotifications={<StaffSubmissionBell />}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden" style={{ height: "calc(100dvh - 3.5rem)", maxHeight: "calc(100vh - 3.5rem)" }}>
        {navOpen ? (
          <button
            type="button"
            id="admin-nav-backdrop"
            className="fixed inset-0 top-14 z-40 cursor-default bg-black/45 backdrop-blur-[1px] lg:hidden"
            aria-label="Tutup menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <div
          id="admin-sidebar-panel"
          className={cn(
            "fixed bottom-0 left-0 top-14 z-50 flex w-[min(18rem,92vw)] flex-col border-r shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out lg:static lg:top-auto lg:z-auto lg:h-auto lg:w-56 lg:shrink-0 lg:translate-x-0 lg:shadow-none",
            "lg:transition-none",
            navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
          style={{ background: "var(--bg-sidebar)", borderColor: "rgba(255,255,255,0.06)" }}
        >
          <Suspense fallback={<SidebarSkeleton />}>
            <AdminSidebar classes={sidebarClasses} />
          </Suspense>
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-pb-safe-bottom px-3 pt-4 pb-safe-bottom sm:px-5 sm:pt-5">
          {children}
        </main>
      </div>
    </div>
  );
}
