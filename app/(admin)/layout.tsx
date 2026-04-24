import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layouts/TopBar";
import { AdminSidebar } from "@/components/layouts/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") redirect("/admin/login");
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
