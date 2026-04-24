import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const grade = searchParams.get("grade");
  const classId = searchParams.get("classId");
  const search = searchParams.get("search");

  const where: any = {};
  if (search) where.student = { name: { contains: search, mode: "insensitive" } };
  if (classId) where.student = { ...where.student, classId };
  if (grade) where.student = { ...where.student, class: { grade } };

  const records = await prisma.violationRecord.findMany({
    where,
    include: { student: { include: { class: true } }, violationType: true },
    orderBy: [{ student: { name: "asc" } }, { date: "desc" }],
  });

  // Compute total points per student
  const allRecords = await prisma.violationRecord.findMany({ select: { studentId: true, points: true } });
  const totalPointsMap = new Map<string, number>();
  for (const r of allRecords) {
    totalPointsMap.set(r.studentId, (totalPointsMap.get(r.studentId) || 0) + r.points);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistem Poin Pelanggaran";
  workbook.created = new Date();

  // Sheet 1: All records
  const sheet1 = workbook.addWorksheet("Catatan Pelanggaran");
  sheet1.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "Nama Siswa", key: "name", width: 25 },
    { header: "NISN", key: "nisn", width: 15 },
    { header: "Kelas", key: "class", width: 12 },
    { header: "Jenis Pelanggaran", key: "violation", width: 35 },
    { header: "Kategori", key: "category", width: 12 },
    { header: "Poin Pelanggaran", key: "points", width: 16 },
    { header: "Total Poin Siswa", key: "totalPoints", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Sesi", key: "session", width: 15 },
    { header: "Keterangan", key: "notes", width: 30 },
    { header: "Tanggal", key: "date", width: 18 },
    { header: "Dicatat oleh", key: "createdBy", width: 20 },
  ];

  // Style header
  const headerRow = sheet1.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2340" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF2E4FBF" } } };
  });
  headerRow.height = 28;

  const catLabels: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };

  records.forEach((r, i) => {
    const total = totalPointsMap.get(r.studentId) || 0;
    const status = total >= 75 ? "Kritis" : total >= 50 ? "Perhatian" : "Normal";
    const row = sheet1.addRow({
      no: i + 1, name: r.student.name, nisn: r.student.nisn || "—", class: r.student.class?.name || "—",
      violation: r.violationType.name, category: catLabels[r.violationType.category] || r.violationType.category,
      points: r.points, totalPoints: total, status, session: r.session || "—", notes: r.notes || "—",
      date: format(r.date, "dd/MM/yyyy", { locale: localeId }), createdBy: r.createdByName || "—",
    });
    // Color rows based on status
    const bgColor = total >= 75 ? "FFFCE8E8" : total >= 50 ? "FFFFF8E8" : "FFF7FFF9";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle" };
    });
  });

  // Sheet 2: Summary by student
  const sheet2 = workbook.addWorksheet("Rekap Per Siswa");
  sheet2.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "Nama Siswa", key: "name", width: 28 },
    { header: "NISN", key: "nisn", width: 15 },
    { header: "Kelas", key: "class", width: 12 },
    { header: "Jumlah Pelanggaran", key: "count", width: 20 },
    { header: "Total Poin", key: "total", width: 13 },
    { header: "Status", key: "status", width: 12 },
  ];
  const headerRow2 = sheet2.getRow(1);
  headerRow2.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2340" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow2.height = 28;

  const studentMap = new Map<string, { name: string; nisn: string; class: string; count: number; total: number }>();
  for (const r of records) {
    const existing = studentMap.get(r.studentId);
    if (existing) { existing.count++; existing.total += r.points; }
    else { studentMap.set(r.studentId, { name: r.student.name, nisn: r.student.nisn || "—", class: r.student.class?.name || "—", count: 1, total: r.points }); }
  }

  [...studentMap.values()].sort((a, b) => b.total - a.total).forEach((s, i) => {
    const status = s.total >= 75 ? "Kritis" : s.total >= 50 ? "Perhatian" : "Normal";
    sheet2.addRow({ no: i + 1, name: s.name, nisn: s.nisn, class: s.class, count: s.count, total: s.total, status });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `catatan-pelanggaran-${format(new Date(), "yyyyMMdd")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
