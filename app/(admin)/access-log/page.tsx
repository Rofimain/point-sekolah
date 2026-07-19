import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/staff-roles";
import AccessLogClient from "./AccessLogClient";

export const dynamic = "force-dynamic";

export default async function AccessLogPage() {
  const session = await getSafeServerSession();
  if (!session || !isSuperAdmin(session.user.role)) redirect("/dashboard");
  return <AccessLogClient />;
}
