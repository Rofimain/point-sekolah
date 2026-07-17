import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";
import { canManageData } from "@/lib/staff-roles";

function staffOk(role: string | undefined) {
  return canManageData(role);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Poin Pelanggaran";
  wb.created = new Date();

  const ws = wb.addWorksheet("Data siswa", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "nama", key: "nama", width: 30 },
    { header: "nisn", key: "nisn", width: 14 },
    { header: "nama_kelas", key: "nama_kelas", width: 20 },
    { header: "email", key: "email", width: 38 },
    { header: "password", key: "password", width: 18 },
  ];
  const h = ws.getRow(1);
  h.font = { bold: true };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEFF" } };
  h.alignment = { vertical: "middle" };
  ws.addRow({
    nama: "Contoh Siswa",
    nisn: "0012345678",
    nama_kelas: "X MIPA 1",
    email: "",
    password: "",
  });

  const help = wb.addWorksheet("Petunjuk");
  help.getColumn(1).width = 96;
  const lines = [
    "Cara impor siswa (halaman Data Siswa → tab Impor bulk):",
    "",
    "=== Format Excel (.xlsx) tanpa foto ===",
    "1. Isi baris data di sheet \"Data siswa\" di bawah baris judul. Hapus baris contoh jika tidak dipakai.",
    "2. Kolom wajib: nama, nisn, nama_kelas. Kolom email dan password boleh dikosongkan.",
    "3. nama_kelas harus sama persis dengan nama kelas di Data Siswa → tab Kelas, contoh: X MIPA 1.",
    "4. Jika email kosong, sistem membuat email otomatis: nisn@domain-siswa sekolah.",
    "5. Jika password kosong, dipakai password default sekolah (lihat dokumentasi admin).",
    "",
    "=== Format ZIP dengan foto profil (disarankan) ===",
    "6. Buat folder, contoh: impor-siswa/",
    "7. Letakkan file Excel di dalamnya (nama bebas, contoh: data.xlsx) — isi sama seperti di atas.",
    "8. Buat subfolder foto/ berisi foto siswa. Nama file = NISN + ekstensi:",
    "     foto/0012345678.jpg",
    "     foto/0012345679.png",
    "   Hanya JPEG (.jpg/.jpeg) atau PNG (.png). Satu foto per NISN.",
    "9. Zip seluruh isi folder (data.xlsx + foto/) menjadi satu file .zip, lalu unggah di tab Impor bulk.",
    "10. Foto ikut tersimpan di profil user/siswa (satu akun = role STUDENT).",
    "",
    "=== Catatan ===",
    "11. Tempel CSV/tab di web tidak mendukung foto — gunakan unggah .xlsx atau .zip.",
    "12. Telegram ortu: tidak diisi lewat Excel. Setelah siswa masuk, Admin salin tautan di Manajemen Pengguna.",
    "13. Maks. 500 baris; .xlsx maks. 8 MB; .zip (dengan foto) maks. 40 MB.",
  ];
  lines.forEach((t, i) => {
    const row = help.getRow(i + 1);
    row.getCell(1).value = t;
    if (i === 0) row.font = { bold: true, size: 12 };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-siswa.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
