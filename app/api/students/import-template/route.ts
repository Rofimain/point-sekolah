import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";
import { isStaffRole } from "@/lib/staff-roles";

function staffOk(role: string | undefined) {
  return isStaffRole(role);
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
    { header: "telegram_ortu", key: "telegram_ortu", width: 28 },
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
    telegram_ortu: "",
  });

  const help = wb.addWorksheet("Petunjuk");
  help.getColumn(1).width = 92;
  const lines = [
    "Cara impor siswa (halaman Data Siswa → tab Impor bulk):",
    "",
    "1. Isi baris data di sheet \"Data siswa\" di bawah baris judul. Hapus baris contoh jika tidak dipakai.",
    "2. Kolom wajib: nama, nisn, nama_kelas. Kolom email, password, dan telegram_ortu boleh dikosongkan.",
    "3. nama_kelas harus sama persis dengan nama kelas di Data Siswa → tab Kelas, contoh: X MIPA 1.",
    "4. Jika email kosong, sistem membuat email otomatis: nisn@domain-siswa sekolah.",
    "5. Jika password kosong, dipakai password default sekolah (lihat dokumentasi admin).",
    "6. telegram_ortu: Chat ID angka atau @username Telegram wali (setelah /start ke bot sekolah). Untuk notifikasi pelanggaran.",
    "7. Simpan file sebagai .xlsx lalu salin blok tabel (termasuk judul) ke area tempel di web, atau tempel dari Excel langsung.",
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
