import { isStrictEvidenceImageDataUrl } from "@/lib/evidence-data-url";

/** Pelanggaran di atas ambang ini wajib bukti (foto) dan/atau tanda tangan digital murid. */
export function heavyViolationPointsThreshold(): number {
  const n = parseInt(process.env.NEXT_PUBLIC_HEAVY_VIOLATION_POINTS || "20", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export function violationNeedsEvidence(points: number): boolean {
  return points > heavyViolationPointsThreshold();
}

const MAX_EVIDENCE_CHARS = 550_000;

/** Foto data-URL yang masuk akal, atau teks pengakuan + nama (≥12 karakter), atau gambar tanda tangan. */
export function hasHeavyViolationEvidence(evidenceImageData: string | null | undefined, studentSignatureData: string | null | undefined): boolean {
  const img = (evidenceImageData ?? "").trim();
  const sig = (studentSignatureData ?? "").trim();
  const hasImg = isStrictEvidenceImageDataUrl(img);
  const hasSig = sig.length >= 12 && !sig.startsWith("data:") || isStrictEvidenceImageDataUrl(sig);
  return hasImg || hasSig;
}

export function validateHeavyViolationEvidence(
  points: number,
  evidenceImageData: string | null | undefined,
  studentSignatureData: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const img = (evidenceImageData ?? "").trim();
  const sig = (studentSignatureData ?? "").trim();
  if (img.length > MAX_EVIDENCE_CHARS) {
    return { ok: false, error: "Foto bukti terlalu besar. Gunakan gambar yang lebih kecil (disarankan di bawah 360 KB)." };
  }
  if (img && !isStrictEvidenceImageDataUrl(img)) {
    return { ok: false, error: "Format foto bukti tidak valid. Gunakan JPEG atau PNG." };
  }
  if (sig.length > 50_000) {
    return { ok: false, error: "Data tanda tangan / teks terlalu panjang." };
  }
  if (sig.startsWith("data:") && !isStrictEvidenceImageDataUrl(sig)) {
    return { ok: false, error: "Format gambar tanda tangan tidak valid." };
  }
  if (!violationNeedsEvidence(points)) return { ok: true };
  if (!hasHeavyViolationEvidence(evidenceImageData, studentSignatureData)) {
    return {
      ok: false,
      error: `Pelanggaran di atas ${heavyViolationPointsThreshold()} poin wajib dilampiri foto bukti dan/atau kolom tanda tangan / pengakuan tertulis murid (minimal 12 karakter).`,
    };
  }
  return { ok: true };
}
