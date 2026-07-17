/**
 * Kompresi gambar di browser (Canvas + JPEG). Hanya impor dari komponen `"use client"`.
 * Mendukung JPG/PNG/WebP/GIF/AVIF/HEIC (iPhone) dan fallback dekoding untuk variasi MIME dari Android/iOS.
 */

export type CompressImageOptions = {
  maxBytes?: number;
  maxDimension?: number;
  minShortSide?: number;
};

const DEFAULT_MAX_BYTES = 340 * 1024;
const DEFAULT_MAX_DIM = 1920;
const DEFAULT_MIN_SHORT = 320;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Gagal membaca hasil"));
    r.readAsDataURL(blob);
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}

/** Terima image/*, HEIC tanpa MIME benar, atau octet-stream dengan ekstensi gambar (sering dari iOS). */
export function isProbablyImageFile(file: File): boolean {
  const t = (file.type || "").trim().toLowerCase();
  if (t.startsWith("image/")) {
    if (t === "image/svg+xml") return false;
    return true;
  }
  const n = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|tif|tiff|heic|heif|avif)$/i.test(n)) return true;
  if (t === "application/octet-stream" || t === "" || t === "binary/octet-stream") {
    return /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(n);
  }
  return false;
}

function isHeicLike(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const n = file.name.toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif");
}

async function convertHeicIfNeeded(file: File): Promise<File> {
  if (!isHeicLike(file)) return file;

  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    const name =
      file.name.replace(/\.(heic|heif)$/i, ".jpg").trim() || `photo-${Date.now()}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
    console.warn("[compress-image] heic2any:", e);
    throw new Error(
      "Foto HEIC/HEIF gagal dibuka di perangkat ini. Di iPhone: Pengaturan → Kamera → Format → «Paling Kompatibel», atau pilih «Salin sebagai JPG» lalu unggah."
    );
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    return await createImageBitmap(file);
  }
}

async function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth < 1 || img.naturalHeight < 1) {
        reject(new Error("Ukuran gambar tidak valid."));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibuka di peramban ini (coba format JPG atau PNG)."));
    };
    img.src = url;
  });
}

/** Decode gambar menjadi bitmap atau elemen Image (fallback untuk format yang tidak didukung createImageBitmap). */
async function decodeRaster(file: File): Promise<{ bitmap: ImageBitmap | null; img: HTMLImageElement | null }> {
  try {
    const bitmap = await loadBitmap(file);
    return { bitmap, img: null };
  } catch {
    try {
      const img = await loadHtmlImage(file);
      return { bitmap: null, img };
    } catch (e) {
      throw e instanceof Error ? e : new Error("Gagal membaca file gambar.");
    }
  }
}

export async function compressImageToDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<{ dataUrl: string; meta: { width: number; height: number; outputBytes: number } }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIM;
  const minShortSide = options.minShortSide ?? DEFAULT_MIN_SHORT;

  if (!isProbablyImageFile(file)) {
    throw new Error("Gunakan file gambar (JPG, PNG, HEIC, WebP, dll.).");
  }
  if (file.size > 40 * 1024 * 1024) {
    throw new Error("File terlalu besar untuk diproses di peramban (maks. ~40 MB).");
  }

  const prepared = await convertHeicIfNeeded(file);
  const decoded = await decodeRaster(prepared);

  const bitmap = decoded.bitmap;
  const htmlImg = decoded.img;

  const srcW = bitmap ? bitmap.width : htmlImg!.naturalWidth;
  const srcH = bitmap ? bitmap.height : htmlImg!.naturalHeight;
  if (srcW < 1 || srcH < 1) {
    bitmap?.close();
    throw new Error("Ukuran gambar tidak valid.");
  }

  const drawSource: CanvasImageSource = (bitmap ?? htmlImg!) as CanvasImageSource;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Peramban tidak mendukung pemrosesan gambar.");

    let cw = srcW;
    let ch = srcH;
    const scale0 = Math.min(1, maxDimension / Math.max(srcW, srcH));
    cw = Math.max(1, Math.round(srcW * scale0));
    ch = Math.max(1, Math.round(srcH * scale0));

    const encodeAtCurrentSize = async (): Promise<Blob> => {
      canvas.width = cw;
      canvas.height = ch;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(drawSource, 0, 0, cw, ch);

      let best: Blob | null = null;
      for (let q = 0.92; q >= 0.34; q -= 0.05) {
        const b = await canvasToJpegBlob(canvas, q);
        if (!b) continue;
        if (b.size <= maxBytes) return b;
        if (!best || b.size < best.size) best = b;
      }
      const fallback = best ?? (await canvasToJpegBlob(canvas, 0.34));
      if (!fallback) throw new Error("Gagal mengompres gambar.");
      return fallback;
    };

    let blob = await encodeAtCurrentSize();
    let iterations = 0;

    while (blob.size > maxBytes && iterations < 24) {
      iterations++;
      const shortSide = Math.min(cw, ch);
      if (shortSide <= minShortSide) break;
      const factor = blob.size > maxBytes * 2 ? 0.82 : 0.88;
      cw = Math.max(1, Math.round(cw * factor));
      ch = Math.max(1, Math.round(ch * factor));
      blob = await encodeAtCurrentSize();
    }

    const dataUrl = await blobToDataUrl(blob);

    return {
      dataUrl,
      meta: {
        width: cw,
        height: ch,
        outputBytes: blob.size,
      },
    };
  } finally {
    bitmap?.close();
  }
}

export const COMPRESS_TARGET_BYTES_STUDENT = 340 * 1024;
export const COMPRESS_TARGET_BYTES_ADMIN = 360 * 1024;
/** Foto profil user — lebih kecil dari bukti pelanggaran. */
export const COMPRESS_TARGET_BYTES_AVATAR = 80 * 1024;
export const COMPRESS_MAX_DIM_AVATAR = 512;
