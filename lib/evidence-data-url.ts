const MAX_IMAGE_BYTES = 400 * 1024;
const IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

export type ParsedEvidenceImage = {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
};

export function parseEvidenceImageDataUrl(value: string, maxBytes = MAX_IMAGE_BYTES): ParsedEvidenceImage {
  const match = IMAGE_DATA_URL.exec(value.trim());
  if (!match) throw new Error("Format gambar bukti tidak valid.");

  let decoded: string;
  try {
    decoded = atob(match[2]);
  } catch {
    throw new Error("Data base64 gambar tidak valid.");
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (bytes.length < 4 || bytes.length > maxBytes) throw new Error("Ukuran gambar bukti tidak valid.");

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (match[1] === "jpeg" && !isJpeg) throw new Error("Isi gambar JPEG tidak valid.");
  if (match[1] === "png" && !isPng) throw new Error("Isi gambar PNG tidak valid.");

  return { bytes, mime: match[1] === "jpeg" ? "image/jpeg" : "image/png" };
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
