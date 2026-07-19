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
    { header: "email", key: "email", width: 38 },
    { header: "nama_kelas", key: "nama_kelas", width: 20 },
    { header: "nisn", key: "nisn", width: 14 },
    { header: "password", key: "password", width: 18 },
  ];
  const h = ws.getRow(1);
  h.font = { bold: true };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEFF" } };
  h.alignment = { vertical: "middle" };
  ws.addRow({
    nama: "Contoh Siswa",
    email: "siswa.contoh@siswa.sekolah.sch.id",
    nama_kelas: "X MIPA 1",
    nisn: "",
    password: "",
  });

  const help = wb.addWorksheet("Petunjuk");
  help.getColumn(1).width = 96;
  const lines = [
    "Cara impor siswa (halaman Data Siswa → tab Impor bulk):",
    "",
    "=== Format Excel (.xlsx) tanpa foto ===",
    "1. Isi baris data di sheet \"Data siswa\" di bawah baris judul. Hapus baris contoh jika tidak dipakai.",
    "2. Kolom wajib: nama, email, nama_kelas. NISN dan password opsional.",
    "3. Login siswa memakai email (bukan NISN). NISN hanya data tambahan bila sudah ada.",
    "4. nama_kelas harus sama persis dengan nama kelas di Data Siswa → tab Kelas, contoh: X MIPA 1.",
    "5. Jika email kosong tapi NISN diisi, sistem membuat email otomatis: nisn@domain-siswa sekolah.",
    "6. Jika password kosong, dipakai password default sekolah (lihat dokumentasi admin).",
    "",
    "=== Format ZIP dengan foto profil (disarankan) ===",
    "7. Buat folder, contoh: impor-siswa/",
    "8. Letakkan file Excel di dalamnya (nama bebas, contoh: data.xlsx) — isi sama seperti di atas.",
    "9. Buat subfolder foto/ berisi foto siswa. Nama file = nama siswa (boleh disingkat) atau NISN:",
    "     foto/Ahmad Fauzi Muharrom.jpg",
    "     foto/ahmad fauzi m.jpg",
    "     foto/ahmad fauzi.jpg",
    "     foto/0012345678.png   (jika kolom nisn diisi)",
    "   Hanya JPEG (.jpg/.jpeg) atau PNG (.png). Satu foto per siswa.",
    "10. Sistem mencocokkan nama file ke kolom nama (inisial/singkatan OK). Jika dua siswa mirip, foto tidak dipasangkan.",
    "11. Zip seluruh isi folder (data.xlsx + foto/) menjadi satu file .zip, lalu unggah di tab Impor bulk.",
    "12. Foto ikut tersimpan di profil user/siswa (satu akun = role STUDENT).",
    "",
    "=== Catatan ===",
    "13. Tempel CSV/tab di web tidak mendukung foto — gunakan unggah .xlsx atau .zip.",
    "14. Telegram ortu: tidak diisi lewat Excel. Setelah siswa masuk, Admin salin tautan di Manajemen Pengguna.",
    "15. Maks. 500 baris; .xlsx maks. 8 MB; .zip (dengan foto) maks. 40 MB.",
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
