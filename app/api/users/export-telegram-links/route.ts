import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { buildParentTelegramDeepLink } from "@/lib/parent-telegram-link";

const MAX_ROWS = 15_000;

/**
 * Super Admin: unduh Excel nama siswa, kelas, token & tautan Telegram ortu.
 * Query sama dengan filter daftar: search (nama), classId. Hanya role siswa.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!bot) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME di server untuk membuat tautan." },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const classId = searchParams.get("classId")?.trim() || "";
  const roleFilter = searchParams.get("role")?.trim() || "";

  if (roleFilter && roleFilter !== "STUDENT") {
    return NextResponse.json(
      {
        error:
          'Unduh ini khusus siswa. Di filter atas, pilih Role "Siswa" atau "Semua Role", lalu unduh lagi.',
      },
      { status: 400 }
    );
  }

  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
  };
  if (classId) where.classId = classId;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const count = await prisma.user.count({ where });
  if (count > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Terlalu banyak baris (${count}). Persempit filter kelas atau pencarian nama (maks. ${MAX_ROWS} siswa per unduhan).`,
      },
      { status: 400 }
    );
  }

  const students = await prisma.user.findMany({
    where,
    orderBy: [{ name: "asc" }],
    select: {
      name: true,
      nisn: true,
      email: true,
      active: true,
      parentTelegram: true,
      parentTelegramLinkToken: true,
      class: { select: { name: true, grade: true, major: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Poin Pelanggaran";
  wb.created = new Date();

  const ws = wb.addWorksheet("Tautan Telegram ortu", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "nama", width: 28 },
    { header: "nisn", width: 14 },
    { header: "nama_kelas", width: 22 },
    { header: "email", width: 36 },
    { header: "aktif", width: 8 },
    { header: "status_telegram_ortu", width: 28 },
    { header: "token_tautan", width: 36 },
    { header: "tautan_telegram_ortu", width: 56 },
  ];

  const h = ws.getRow(1);
  h.font = { bold: true };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEFF" } };

  for (const s of students) {
    const classLabel = s.class
      ? [s.class.grade, s.class.name, s.class.major].filter(Boolean).join(" ").trim()
      : "";
    const connected = Boolean(s.parentTelegram?.trim());
    const token = s.parentTelegramLinkToken?.trim() || "";
    let status: string;
    let tautan = "";
    if (connected) {
      status = "Sudah terhubung (ortu sudah Start)";
    } else if (token) {
      status = "Menunggu ortu — kirim tautan di kolom terkanan";
      tautan = buildParentTelegramDeepLink(bot, token);
    } else {
      status = "Tanpa token — buka Edit siswa lalu Salin tautan (generate baru)";
    }

    ws.addRow([
      s.name,
      s.nisn || "",
      classLabel,
      s.email,
      s.active ? "ya" : "tidak",
      status,
      connected ? "" : token,
      tautan,
    ]);
  }

  const help = wb.addWorksheet("Petunjuk");
  help.getColumn(1).width = 96;
  const lines = [
    "RAHASIA — file ini berisi token tautan Telegram. Jangan diunggah ke internet atau dibagikan sembarangan.",
    "",
    "Kolom tautan hanya terisi jika ortu belum menghubungkan akun (belum Start ke bot). Siswa yang sudah terhubung hanya tampil status; tautan lama sudah tidak dipakai.",
    "",
    "Filter unduhan mengikuti filter di halaman Manajemen Pengguna (cari nama + kelas) saat Anda mengklik unduh.",
    `Total baris data: ${students.length}`,
  ];
  lines.forEach((t, i) => {
    const row = help.getRow(i + 1);
    row.getCell(1).value = t;
    if (i === 0) row.font = { bold: true, color: { argb: "FF990000" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tautan-telegram-ortu-${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
