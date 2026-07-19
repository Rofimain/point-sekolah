import JSZip from "jszip";
import ExcelJS from "exceljs";
import { worksheetToBulkRows } from "@/lib/parse-student-excel-sheet";
import type { BulkStudentRow } from "@/lib/students-bulk-run";
import { imageBufferToPhotoDataUrl } from "@/lib/user-photo";
import {
  assignPhotosToRows,
  photoStemFromFilename,
  type PhotoMatchInput,
} from "@/lib/student-photo-match";

export type StudentImportPackageResult = {
  rows: BulkStudentRow[];
  /** Stem nama file foto yang tidak cocok ke baris Excel. */
  unmatchedPhotos: string[];
  /** Foto gagal dibaca / format tidak valid / ambigu. */
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
 * - folder foto/ (atau root): nama file = NISN atau nama siswa (boleh disingkat)
 *
 * Juga menerima .xlsx murni (tanpa foto).
 */
export async function parseStudentImportPackage(buf: Buffer): Promise<StudentImportPackageResult> {
  if (!isZipMagic(buf)) {
    throw new Error("File harus .xlsx atau .zip (Excel + folder foto)");
  }

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
  const photos: PhotoMatchInput[] = [];
  const photoErrors: { file: string; message: string }[] = [];
  const seenStem = new Map<string, string>();

  if (looksLikeWorkbookOnly && xlsxEntries.length === 0) {
    workbookBuf = buf;
  } else if (xlsxEntries.length >= 1) {
    const preferred =
      xlsxEntries.find((p) => /(?:^|\/)(data|siswa|template-import-siswa)\.xlsx$/i.test(normalizePhotoKey(p))) ||
      xlsxEntries[0];
    workbookBuf = Buffer.from(await zip.files[preferred].async("uint8array"));

    for (const path of entries) {
      if (!isPhotoPath(path)) continue;
      const stem = photoStemFromFilename(path);
      if (!stem) {
        photoErrors.push({ file: path, message: "Ekstensi foto harus .jpg/.jpeg/.png" });
        continue;
      }
      const stemKey = stem.toLowerCase();
      if (seenStem.has(stemKey)) {
        photoErrors.push({
          file: path,
          message: `Nama file foto ganda (sama dengan ${seenStem.get(stemKey)})`,
        });
        continue;
      }
      seenStem.set(stemKey, path);
      const data = Buffer.from(await zip.files[path].async("uint8array"));
      photos.push({ path, stem, data });
    }
  } else if (looksLikeWorkbookOnly) {
    workbookBuf = buf;
  } else {
    throw new Error(
      "ZIP harus berisi satu file .xlsx plus folder foto/ (nama file = nama siswa atau NISN)"
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
    throw new Error("Tidak ada baris data di sheet (pastikan ada header nama/email atau kolom terisi)");
  }

  const matched = assignPhotosToRows(rows, photos, (buf) => {
    const r = imageBufferToPhotoDataUrl(buf);
    if ("error" in r) return { error: r.error };
    return { photoData: r.photoData };
  });

  return {
    rows,
    unmatchedPhotos: matched.unmatchedPhotos,
    photoErrors: [...photoErrors, ...matched.photoErrors],
  };
}
