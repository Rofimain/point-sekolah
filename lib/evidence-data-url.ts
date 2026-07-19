/** Batas decode server per foto bukti (~selaras target kompresi client 800 KB). */
export const MAX_EVIDENCE_IMAGE_BYTES = 850 * 1024;
/** Batas absolut keras (5 MB decoded) — ditolak meski client mengirim MIME valid. */
export const ABSOLUTE_MAX_EVIDENCE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_EVIDENCE_IMAGES = 5;
/** Panjang string data-URL per foto (base64 ≈ 4/3 byte + header). */
export const MAX_EVIDENCE_CHARS_PER_IMAGE = 1_200_000;

const ALLOWED_MIME = new Set(["jpeg", "png", "webp"]);
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export type ParsedEvidenceImage = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png" | "image/webp";
};

function isJpegMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}

function isPngMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/** WebP: RIFF....WEBP */
function isWebpMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function parseEvidenceImageDataUrl(value: string, maxBytes = MAX_EVIDENCE_IMAGE_BYTES): ParsedEvidenceImage {
  const match = IMAGE_DATA_URL.exec(value.trim());
  if (!match || !ALLOWED_MIME.has(match[1])) {
    throw new Error("Format gambar bukti tidak valid.");
  }

  let decoded: string;
  try {
    decoded = atob(match[2]);
  } catch {
    throw new Error("Data base64 gambar tidak valid.");
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const hardCap = Math.min(maxBytes, ABSOLUTE_MAX_EVIDENCE_IMAGE_BYTES);
  if (bytes.length < 4 || bytes.length > hardCap) {
    throw new Error("Ukuran gambar bukti tidak valid.");
  }

  const declared = match[1] as "jpeg" | "png" | "webp";
  if (declared === "jpeg" && !isJpegMagic(bytes)) throw new Error("Isi gambar JPEG tidak valid.");
  if (declared === "png" && !isPngMagic(bytes)) throw new Error("Isi gambar PNG tidak valid.");
  if (declared === "webp" && !isWebpMagic(bytes)) throw new Error("Isi gambar WebP tidak valid.");

  return {
    bytes,
    mime: declared === "jpeg" ? "image/jpeg" : declared === "png" ? "image/png" : "image/webp",
  };
}

export function isStrictEvidenceImageDataUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    parseEvidenceImageDataUrl(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ambil daftar foto dari body API.
 * Mendukung `evidenceImages: string[]` (baru) dan `evidenceImageData: string` (lama).
 */
export function normalizeEvidenceImagesFromBody(body: {
  evidenceImages?: unknown;
  evidenceImageData?: unknown;
}): string[] {
  const out: string[] = [];
  if (Array.isArray(body.evidenceImages)) {
    for (const item of body.evidenceImages) {
      if (typeof item === "string" && item.trim()) out.push(item.trim());
    }
  } else if (typeof body.evidenceImageData === "string" && body.evidenceImageData.trim()) {
    out.push(body.evidenceImageData.trim());
  }
  return out.slice(0, MAX_EVIDENCE_IMAGES);
}

export function validateEvidenceImageList(
  images: string[]
): { ok: true; images: string[] } | { ok: false; error: string } {
  if (images.length > MAX_EVIDENCE_IMAGES) {
    return { ok: false, error: `Maksimal ${MAX_EVIDENCE_IMAGES} foto bukti per catatan.` };
  }
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.length > MAX_EVIDENCE_CHARS_PER_IMAGE) {
      return {
        ok: false,
        error: `Foto bukti ke-${i + 1} terlalu besar. Kompres otomatis biasanya di bawah ~800 KB.`,
      };
    }
    if (!isStrictEvidenceImageDataUrl(img)) {
      return {
        ok: false,
        error: `Format foto bukti ke-${i + 1} tidak valid. Gunakan JPEG, PNG, atau WebP.`,
      };
    }
  }
  return { ok: true, images };
}
