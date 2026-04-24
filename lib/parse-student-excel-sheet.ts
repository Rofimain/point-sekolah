import type ExcelJS from "exceljs";
import type { BulkStudentRow } from "@/lib/students-bulk-run";

export function cellStr(cell: ExcelJS.Cell): string {
  if (!cell || cell.value == null || cell.value === "") return "";
  const v = cell.value;
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (typeof v === "boolean") return v ? "true" : "";
  if (typeof v === "object" && v !== null) {
    if ("text" in v && typeof (v as { text?: string }).text === "string") return (v as { text: string }).text.trim();
    if ("richText" in v && Array.isArray((v as { richText?: { text: string }[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim();
    }
    if ("result" in v && (v as { result?: unknown }).result != null) return String((v as { result: unknown }).result).trim();
  }
  return String(v).trim();
}

function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildHeaderMap(headerRow: ExcelJS.Row): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normHeader(cellStr(cell));
    if (key) m.set(key, colNumber);
  });
  return m;
}

function colOf(map: Map<string, number>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const nk = normHeader(k);
    if (map.has(nk)) return map.get(nk);
  }
  return undefined;
}

function rowVal(row: ExcelJS.Row, col: number): string {
  return cellStr(row.getCell(col));
}

function field(
  row: ExcelJS.Row,
  map: Map<string, number>,
  keys: string[],
  fallbackCol: number,
  useMap: boolean
): string {
  if (useMap) {
    const c = colOf(map, ...keys);
    if (c != null) return rowVal(row, c);
  }
  return rowVal(row, fallbackCol);
}

/**
 * Baca sheet Excel. Baris 1 = header jika sel A1 seperti "nama" / "nisn".
 */
export function worksheetToBulkRows(worksheet: ExcelJS.Worksheet): BulkStudentRow[] {
  const out: BulkStudentRow[] = [];
  if (worksheet.rowCount < 1) return out;

  const row1 = worksheet.getRow(1);
  const map = buildHeaderMap(row1);
  const r1 = normHeader(cellStr(row1.getCell(1)));
  const isHeaderRow = r1 === "nama" || r1 === "name" || r1 === "nisn" || map.has("nama") || map.has("nisn");
  const useMap = isHeaderRow;
  const start = isHeaderRow ? 2 : 1;

  for (let r = start; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const name = field(row, map, ["nama", "name", "nama_siswa", "nama_lengkap"], 1, useMap);
    const nisn = field(row, map, ["nisn", "nis", "nomor_induk"], 2, useMap);
    const email = field(row, map, ["email", "surel"], 4, useMap);
    const password = field(row, map, ["password", "kata_sandi", "katasandi"], 5, useMap);

    if (!name && !nisn) continue;

    let classId: string | undefined;
    let className: string | undefined;
    if (useMap) {
      const cid = colOf(map, "id_kelas", "class_id", "kelas_id");
      const cnm = colOf(map, "nama_kelas", "kelas", "class", "class_name");
      if (cid != null) {
        const v = rowVal(row, cid);
        if (v) classId = v;
      }
      if (cnm != null) {
        const v = rowVal(row, cnm);
        if (v) className = v;
      }
    } else {
      const third = rowVal(row, 3);
      if (third.startsWith("cls-")) classId = third;
      else if (third) className = third;
    }

    out.push({
      name,
      nisn,
      classId,
      className,
      email: email || undefined,
      password: password || undefined,
    });
  }

  return out;
}
