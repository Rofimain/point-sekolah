import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getCachedSidebarClasses } from "@/lib/cached-queries";
import { GlobalToaster } from "@/components/GlobalToaster";
import AdminChrome from "@/components/layouts/AdminChrome";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, sidebarClasses] = await Promise.all([getSafeServerSession(), getCachedSidebarClasses()]);
  if (!session || session.user.role === "STUDENT") redirect("/admin/login");

  return (
    <SessionProvider session={session}>
      <GlobalToaster />
      <AdminChrome sidebarClasses={sidebarClasses}>{children}</AdminChrome>
    </SessionProvider>
  );
}
