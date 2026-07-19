import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/staff-roles";
import { buildAccessLogWhere, parseAccessLogQuery } from "@/lib/access-log-query";
import ExcelJS from "exceljs";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const MAX_EXPORT = 10_000;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = parseAccessLogQuery(req.nextUrl.searchParams);
  const where = buildAccessLogWhere(q);

  const items = await prisma.accessLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Poin Pelanggaran";
  wb.created = new Date();
  const ws = wb.addWorksheet("Log akses");
  ws.columns = [
    { header: "Waktu", key: "createdAt", width: 20 },
    { header: "Portal", key: "portal", width: 10 },
    { header: "Kategori", key: "category", width: 10 },
    { header: "Aksi", key: "action", width: 22 },
    { header: "Sukses", key: "success", width: 8 },
    { header: "Pelaku", key: "actorName", width: 24 },
    { header: "Role", key: "actorRole", width: 12 },
    { header: "Ringkasan", key: "summary", width: 48 },
    { header: "Target", key: "target", width: 28 },
    { header: "IP", key: "ip", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const row of items) {
    ws.addRow({
      createdAt: format(row.createdAt, "yyyy-MM-dd HH:mm:ss"),
      portal: row.portal,
      category: row.category,
      action: row.action,
      success: row.success ? "Ya" : "Tidak",
      actorName: row.actorName || "—",
      actorRole: row.actorRole || "—",
      summary: row.summary,
      target: [row.targetType, row.targetId].filter(Boolean).join(" / ") || "—",
      ip: row.ip || "—",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = `log-akses-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
