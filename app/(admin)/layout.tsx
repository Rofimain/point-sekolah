import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getCachedSidebarClasses } from "@/lib/cached-queries";
import { GlobalToaster } from "@/components/GlobalToaster";
import AdminChrome from "@/components/layouts/AdminChrome";
import { isStaffRole } from "@/lib/staff-roles";

/** Semua halaman admin butuh session + DB — jangan SSG saat docker/CI build. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, sidebarClasses] = await Promise.all([getSafeServerSession(), getCachedSidebarClasses()]);
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  return (
    <SessionProvider session={session}>
      <GlobalToaster />
      <AdminChrome sidebarClasses={sidebarClasses}>{children}</AdminChrome>
    </SessionProvider>
  );
}
