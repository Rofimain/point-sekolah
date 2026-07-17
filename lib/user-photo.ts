import { isStrictEvidenceImageDataUrl, MAX_EVIDENCE_IMAGE_BYTES } from "@/lib/evidence-data-url";

/** Batas ukuran foto profil server (selaras validasi data-URL bukti). */
export const MAX_USER_PHOTO_BYTES = MAX_EVIDENCE_IMAGE_BYTES;

export function parseUserPhotoInput(
  value: unknown
): { photoData: string | null; photoPresent: boolean } | { error: string } {
  if (value === undefined) return { photoData: null, photoPresent: false };
  if (value === null || value === "") return { photoData: null, photoPresent: false };
  if (typeof value !== "string" || !isStrictEvidenceImageDataUrl(value)) {
    return { error: "Format foto tidak valid. Gunakan JPEG atau PNG." };
  }
  return { photoData: value.trim(), photoPresent: true };
}

export function parseUserPhotoPatch(
  value: unknown
): { photoData: string | null; photoPresent: boolean } | { error: string } | null {
  if (value === undefined) return null;
  return parseUserPhotoInput(value);
}

function detectImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

/**
 * Ubah buffer JPEG/PNG mentah menjadi data-URL yang lolos `isStrictEvidenceImageDataUrl`.
 */
export function imageBufferToPhotoDataUrl(
  input: Buffer | Uint8Array,
  maxBytes = MAX_USER_PHOTO_BYTES
): { photoData: string; photoPresent: true } | { error: string } {
  const bytes = input instanceof Buffer ? new Uint8Array(input) : input;
  if (bytes.length < 4) return { error: "File foto kosong atau rusak" };
  if (bytes.length > maxBytes) {
    return { error: `Foto terlalu besar (maks. ${Math.round(maxBytes / 1024)} KB)` };
  }
  const mime = detectImageMime(bytes);
  if (!mime) return { error: "Foto harus JPEG atau PNG" };

  const b64 = Buffer.from(bytes).toString("base64");
  const photoData = `data:${mime};base64,${b64}`;
  if (!isStrictEvidenceImageDataUrl(photoData)) {
    return { error: "Format foto tidak valid. Gunakan JPEG atau PNG." };
  }
  return { photoData, photoPresent: true };
}

/** Nama file foto bulk: NISN sebagai stem, ekstensi jpg/jpeg/png. */
export function nisnFromPhotoFilename(filename: string): string | null {
  const base = filename.replace(/^.*[/\\]/, "").trim();
  const m = /^(.+)\.(jpe?g|png)$/i.exec(base);
  if (!m) return null;
  const nisn = m[1].trim();
  return nisn || null;
}
