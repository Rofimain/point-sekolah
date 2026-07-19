import { redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/auth";
import { isStaffRole } from "@/lib/staff-roles";
import CetakSuratClient from "./CetakSuratClient";

export default async function CetakSuratPage() {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  return <CetakSuratClient />;
}
