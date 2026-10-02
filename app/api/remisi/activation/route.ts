import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { requireSuperAdmin, isAuthFail } from "@/lib/api-auth";
import { applyInitialRemisi, previewInitialRemisi } from "@/lib/remisi-activation";

function styleHeader(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2340" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.height = 28;
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (isAuthFail(auth)) return auth.response;

  const preview = await previewInitialRemisi();
  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistem Poin Pelanggaran";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Pratinjau remisi berantai");
    sheet.columns = [
      { header: "Nama", key: "nama", width: 28 },
      { header: "Kelas", key: "kelas", width: 16 },
      { header: "Poin sekarang", key: "poinSekarang", width: 16 },
      { header: "Tahap", key: "tahap", width: 18 },
      { header: "Tanggal jatuh tempo", key: "tanggalDue", width: 28 },
      { header: "Total potongan", key: "totalPotongan", width: 16 },
      { header: "Poin akhir", key: "poinAkhir", width: 14 },
    ];
    styleHeader(sheet);
    for (const row of preview.rows) {
      sheet.addRow({
        nama: row.nama,
        kelas: row.kelas ?? "—",
        poinSekarang: row.poinSekarang,
        tahap: row.tahap.join(", ") || "—",
        tanggalDue: row.tanggalDue.join(", ") || "—",
        totalPotongan: row.totalPotongan,
        poinAkhir: row.poinAkhir,
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `pratinjau-remisi-berantai-${format(new Date(), "yyyyMMdd")}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json(preview);
}

export async function POST() {
  const auth = await requireSuperAdmin();
  if (isAuthFail(auth)) return auth.response;
  const result = await applyInitialRemisi(auth.session);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}
