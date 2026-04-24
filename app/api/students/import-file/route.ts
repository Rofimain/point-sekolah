import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";
import { worksheetToBulkRows } from "@/lib/parse-student-excel-sheet";
import { runBulkStudentImport } from "@/lib/students-bulk-run";

function staffOk(role: string | undefined) {
  return role === "TEACHER" || role === "SUPER_ADMIN";
}

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "File kosong atau tidak valid" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File terlalu besar (maks. 8 MB)" }, { status: 400 });
  }

  const defaultPassword = form.get("defaultPassword")?.toString();

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as never);
  } catch {
    return NextResponse.json({ error: "File bukan Excel .xlsx yang valid" }, { status: 400 });
  }

  const ws = wb.getWorksheet("Data siswa") || wb.worksheets[0];
  if (!ws) {
    return NextResponse.json({ error: "Workbook tidak berisi sheet" }, { status: 400 });
  }

  const rows = worksheetToBulkRows(ws);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris data di sheet (pastikan ada header nama/nisn atau kolom A–B terisi)" }, { status: 400 });
  }

  try {
    const result = await runBulkStudentImport(rows, { defaultPassword });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Impor gagal";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
