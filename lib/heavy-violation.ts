import {
  isStrictEvidenceImageDataUrl,
  MAX_EVIDENCE_CHARS_PER_IMAGE,
  MAX_EVIDENCE_IMAGES,
  validateEvidenceImageList,
} from "@/lib/evidence-data-url";

/** Pelanggaran di atas ambang ini wajib bukti (foto) dan/atau tanda tangan digital murid. */
export function heavyViolationPointsThreshold(): number {
  const n = parseInt(process.env.NEXT_PUBLIC_HEAVY_VIOLATION_POINTS || "20", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export function violationNeedsEvidence(points: number): boolean {
  return points > heavyViolationPointsThreshold();
}

/** Foto data-URL yang masuk akal, atau teks pengakuan + nama (≥12 karakter), atau gambar tanda tangan. */
export function hasHeavyViolationEvidence(
  evidenceImages: string[] | string | null | undefined,
  studentSignatureData: string | null | undefined
): boolean {
  const images = Array.isArray(evidenceImages)
    ? evidenceImages
    : typeof evidenceImages === "string" && evidenceImages.trim()
      ? [evidenceImages.trim()]
      : [];
  const hasImg = images.some((img) => isStrictEvidenceImageDataUrl(img));
  const sig = (studentSignatureData ?? "").trim();
  const hasSig = (sig.length >= 12 && !sig.startsWith("data:")) || isStrictEvidenceImageDataUrl(sig);
  return hasImg || hasSig;
}

export function validateHeavyViolationEvidence(
  points: number,
  evidenceImages: string[] | string | null | undefined,
  studentSignatureData: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const images = Array.isArray(evidenceImages)
    ? evidenceImages.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
    : typeof evidenceImages === "string" && evidenceImages.trim()
      ? [evidenceImages.trim()]
      : [];

  if (images.length > MAX_EVIDENCE_IMAGES) {
    return { ok: false, error: `Maksimal ${MAX_EVIDENCE_IMAGES} foto bukti per catatan.` };
  }
  for (let i = 0; i < images.length; i++) {
    if (images[i].length > MAX_EVIDENCE_CHARS_PER_IMAGE) {
      return {
        ok: false,
        error: `Foto bukti ke-${i + 1} terlalu besar. Disarankan di bawah ~800 KB setelah kompresi.`,
      };
    }
  }

  const listCheck = validateEvidenceImageList(images);
  if (!listCheck.ok) return listCheck;

  const sig = (studentSignatureData ?? "").trim();
  if (sig.length > 50_000) {
    return { ok: false, error: "Data tanda tangan / teks terlalu panjang." };
  }
  if (sig.startsWith("data:") && !isStrictEvidenceImageDataUrl(sig)) {
    return { ok: false, error: "Format gambar tanda tangan tidak valid." };
  }
  if (!violationNeedsEvidence(points)) return { ok: true };
  if (!hasHeavyViolationEvidence(images, studentSignatureData)) {
    return {
      ok: false,
      error: `Pelanggaran di atas ${heavyViolationPointsThreshold()} poin wajib dilampiri foto bukti dan/atau kolom tanda tangan / pengakuan tertulis murid (minimal 12 karakter).`,
    };
  }
  return { ok: true };
}
