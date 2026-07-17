import JSZip from "jszip";
import ExcelJS from "exceljs";
import { worksheetToBulkRows } from "@/lib/parse-student-excel-sheet";
import type { BulkStudentRow } from "@/lib/students-bulk-run";
import { imageBufferToPhotoDataUrl, nisnFromPhotoFilename } from "@/lib/user-photo";

export type StudentImportPackageResult = {
  rows: BulkStudentRow[];
  /** Foto ditemukan di ZIP tapi NISN-nya tidak ada di sheet. */
  unmatchedPhotos: string[];
  /** Foto gagal dibaca / format tidak valid. */
  photoErrors: { file: string; message: string }[];
};

function isZipMagic(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function isPhotoPath(path: string): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (lower.includes("__macosx/") || lower.endsWith("/")) return false;
  const name = lower.split("/").pop() || "";
  return /\.(jpe?g|png)$/.test(name);
}

function normalizePhotoKey(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Parse paket impor .zip:
 * - satu file .xlsx (sheet "Data siswa" atau sheet pertama)
 * - folder foto/ (atau root) berisi {nisn}.jpg|jpeg|png
 *
 * Juga menerima .xlsx murni (tanpa foto).
 */
export async function parseStudentImportPackage(buf: Buffer): Promise<StudentImportPackageResult> {
  if (!isZipMagic(buf)) {
    throw new Error("File harus .xlsx atau .zip (Excel + folder foto)");
  }

  // .xlsx juga ZIP — bedakan: jika ada entry sheet XML tanpa folder foto, treat as workbook.
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir);

  const xlsxEntries = entries.filter((p) => {
    const n = normalizePhotoKey(p).toLowerCase();
    return n.endsWith(".xlsx") && !n.includes("__macosx/");
  });

  const looksLikeWorkbookOnly =
    entries.some((p) => normalizePhotoKey(p).toLowerCase() === "[content_types].xml") &&
    entries.some((p) => /xl\/workbook\.xml$/i.test(normalizePhotoKey(p)));

  let workbookBuf: Buffer;
  const photoByNisn = new Map<string, { path: string; data: Buffer }>();
  const photoErrors: { file: string; message: string }[] = [];

  if (looksLikeWorkbookOnly && xlsxEntries.length === 0) {
    // File .xlsx langsung
    workbookBuf = buf;
  } else if (xlsxEntries.length >= 1) {
    // Paket ZIP berisi .xlsx + foto
    const preferred =
      xlsxEntries.find((p) => /(?:^|\/)(data|siswa|template-import-siswa)\.xlsx$/i.test(normalizePhotoKey(p))) ||
      xlsxEntries[0];
    workbookBuf = Buffer.from(await zip.files[preferred].async("uint8array"));

    for (const path of entries) {
      if (!isPhotoPath(path)) continue;
      const nisn = nisnFromPhotoFilename(path);
      if (!nisn) {
        photoErrors.push({ file: path, message: "Nama file foto harus {nisn}.jpg/png" });
        continue;
      }
      const data = Buffer.from(await zip.files[path].async("uint8array"));
      const key = nisn.trim();
      if (photoByNisn.has(key)) {
        photoErrors.push({ file: path, message: `Foto ganda untuk NISN ${key}` });
        continue;
      }
      photoByNisn.set(key, { path, data });
    }
  } else if (looksLikeWorkbookOnly) {
    workbookBuf = buf;
  } else {
    throw new Error(
      "ZIP harus berisi satu file .xlsx plus folder foto/ (nama file = NISN.jpg atau .png)"
    );
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(workbookBuf as never);
  } catch {
    throw new Error("File Excel .xlsx tidak valid");
  }

  const ws = wb.getWorksheet("Data siswa") || wb.worksheets[0];
  if (!ws) throw new Error("Workbook tidak berisi sheet");

  const rows = worksheetToBulkRows(ws);
  if (rows.length === 0) {
    throw new Error("Tidak ada baris data di sheet (pastikan ada header nama/nisn atau kolom A–B terisi)");
  }

  const usedNisn = new Set<string>();
  for (const row of rows) {
    const nisn = row.nisn?.trim();
    if (!nisn) continue;
    const photo = photoByNisn.get(nisn);
    if (!photo) continue;
    const converted = imageBufferToPhotoDataUrl(photo.data);
    if ("error" in converted) {
      photoErrors.push({ file: photo.path, message: converted.error });
      continue;
    }
    row.photoData = converted.photoData;
    usedNisn.add(nisn);
  }

  const unmatchedPhotos = [...photoByNisn.keys()].filter((n) => !usedNisn.has(n));

  return { rows, unmatchedPhotos, photoErrors };
}
