import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Cetak surat poin hanya untuk staf (guru/piket/wali kelas/super admin) di /students/[id]/cetak. */
export default async function StudentPrintPointsRedirectPage() {
  const session = await getSafeServerSession();
  if (!session) redirect("/login");
  redirect("/form");
}
