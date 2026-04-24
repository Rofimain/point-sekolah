import { redirect } from "next/navigation";

/** URL lama /classes → satu halaman Data Siswa. */
export default function ClassesPageRedirect() {
  redirect("/students?tab=kelas");
}
