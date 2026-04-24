import { Suspense } from "react";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layouts/TopBar";
import { AdminSidebar } from "@/components/layouts/AdminSidebar";
import { SessionProvider } from "@/components/providers/SessionProvider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSafeServerSession();
  if (!session || session.user.role === "STUDENT") redirect("/admin/login");

  const sidebarClasses = await prisma.class.findMany({
    select: { id: true, name: true, grade: true },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
        <TopBar />
        <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
          <Suspense
            fallback={
              <aside className="w-52 flex-shrink-0 border-r" style={{ background: "var(--bg-sidebar)", borderColor: "rgba(255,255,255,0.06)" }} />
            }
          >
            <AdminSidebar classes={sidebarClasses} />
          </Suspense>
          <main className="flex-1 overflow-y-auto p-5">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
