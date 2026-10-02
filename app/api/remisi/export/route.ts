import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { requireExportRecords, isAuthFail } from "@/lib/api-auth";
import { queryRemisiHistory } from "@/lib/remisi-history";
import { formatYmdIndonesia } from "@/lib/point-adjustment-reason";

function styleHeader(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2340" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.height = 28;
}

const STATUS_LABEL = { berlaku: "Berlaku", susulan: "Susulan", dibatalkan: "Dibatalkan" } as const;

export async function GET(req: NextRequest) {
  const auth = await requireExportRecords();
  if (isAuthFail(auth)) return auth.response;

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "manual" ? "manual" : "auto";
  const data = await queryRemisiHistory({
    type,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    classId: sp.get("classId") || undefined,
    status: sp.get("status") || undefined,
    q: sp.get("q") || undefined,
    jenis: sp.get("jenis") || undefined,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistem Poin Pelanggaran";
  workbook.created = new Date();

  if (type === "auto") {
    const sheet = workbook.addWorksheet("Riwayat remisi otomatis");
    sheet.columns = [
      { header: "Tanggal berlaku", key: "tgl", width: 20 },
      { header: "Siswa", key: "siswa", width: 28 },
      { header: "Kelas", key: "kelas", width: 16 },
      { header: "Tahap", key: "tahap", width: 16 },
      { header: "Bersih sejak", key: "sejak", width: 22 },
      { header: "Poin sebelum", key: "sebelum", width: 14 },
      { header: "Poin sesudah", key: "sesudah", width: 14 },
      { header: "Potongan", key: "potongan", width: 12 },
      { header: "Status", key: "status", width: 16 },
      { header: "Sebab batal", key: "sebab", width: 36 },
      { header: "Dicatat", key: "dicatat", width: 20 },
    ];
    styleHeader(sheet);
    for (const row of data.autoRows) {
      sheet.addRow({
        tgl: formatYmdIndonesia(row.effectiveYmd),
        siswa: row.studentName,
        kelas: row.className ?? "—",
        tahap: row.legacy ? "aturan lama" : row.step,
        sejak: row.bersihSejak ?? "—",
        sebelum: row.effectiveBefore ?? "—",
        sesudah: row.effectiveAfter ?? "—",
        potongan: row.pointsDelta,
        status: STATUS_LABEL[row.status],
        sebab: row.sebab ?? "",
        dicatat: format(new Date(row.createdAt), "dd/MM/yyyy HH:mm"),
      });
    }
  } else {
    const sheet = workbook.addWorksheet("Riwayat remisi manual");
    sheet.columns = [
      { header: "Tanggal input", key: "input", width: 18 },
      { header: "Tgl prestasi", key: "prestasi", width: 18 },
      { header: "Siswa", key: "siswa", width: 28 },
      { header: "Kelas", key: "kelas", width: 16 },
      { header: "Jenis", key: "jenis", width: 28 },
      { header: "%", key: "persen", width: 8 },
      { header: "Basis poin", key: "basis", width: 12 },
      { header: "Poin sebelum", key: "sebelum", width: 14 },
      { header: "Poin sesudah", key: "sesudah", width: 14 },
      { header: "Potongan", key: "potongan", width: 12 },
      { header: "Catatan", key: "catatan", width: 30 },
      { header: "Diinput oleh", key: "oleh", width: 22 },
    ];
    styleHeader(sheet);
    for (const row of data.manualRows) {
      sheet.addRow({
        input: formatYmdIndonesia(row.inputYmd),
        prestasi: row.prestasiYmd ? formatYmdIndonesia(row.prestasiYmd) : "—",
        siswa: row.studentName,
        kelas: row.className ?? "—",
        jenis: row.label,
        persen: row.percent ?? "—",
        basis: row.basis,
        sebelum: row.effectiveBefore ?? "—",
        sesudah: row.effectiveAfter ?? "—",
        potongan: row.pointsDelta,
        catatan: row.note ?? "",
        oleh: row.createdByName ?? "—",
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `riwayat-remisi-${type}-${format(new Date(), "yyyyMMdd")}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
