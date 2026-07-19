import JSZip from "jszip";
import { photoStemFromFilename, type PhotoMatchInput } from "@/lib/student-photo-match";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isPhotoPath(path: string): boolean {
  const lower = normalizePath(path).toLowerCase();
  if (lower.includes("__macosx/") || lower.endsWith("/")) return false;
  const name = lower.split("/").pop() || "";
  return /\.(jpe?g|png)$/.test(name);
}

function isZipMagic(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

/**
 * Ambil semua foto JPEG/PNG dari ZIP (folder foto/ atau root).
 * Nama file = NISN atau nama siswa (boleh .JPG / .jpg).
 */
export async function extractPhotosFromZip(buf: Buffer): Promise<{
  photos: PhotoMatchInput[];
  photoErrors: { file: string; message: string }[];
}> {
  if (!isZipMagic(buf)) {
    throw new Error("File harus berupa .zip");
  }

  const zip = await JSZip.loadAsync(buf);
  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const photos: PhotoMatchInput[] = [];
  const photoErrors: { file: string; message: string }[] = [];
  const seenStem = new Map<string, string>();

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

  if (photos.length === 0 && photoErrors.length === 0) {
    throw new Error("ZIP tidak berisi foto .jpg/.jpeg/.png");
  }

  return { photos, photoErrors };
}
