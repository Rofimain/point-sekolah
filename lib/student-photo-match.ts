/**
 * Cocokkan nama file foto dengan nama siswa (dukung singkatan / inisial).
 * Contoh: "ahmad fauzi m" atau "ahmad fauzi" → "Ahmad Fauzi Muharrom"
 */

/** Stem nama file tanpa ekstensi; null jika bukan jpg/png. */
export function photoStemFromFilename(filename: string): string | null {
  const base = filename.replace(/^.*[/\\]/, "").trim();
  const m = /^(.+)\.(jpe?g|png)$/i.exec(base);
  if (!m) return null;
  const stem = m[1].trim();
  return stem || null;
}

/** Token nama: lowercase, spasi dari _ - ., buang karakter non-huruf/angka. */
export function normalizeNameTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_.;,]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokenMatches(photoTok: string, nameTok: string): "exact" | "prefix" | "initial" | null {
  if (!photoTok || !nameTok) return null;
  if (photoTok === nameTok) return "exact";
  if (photoTok.length === 1 && nameTok.startsWith(photoTok)) return "initial";
  // Singkatan kata (min 2 huruf): "muhar" → "muharrom"
  if (photoTok.length >= 2 && nameTok.startsWith(photoTok)) return "prefix";
  return null;
}

/**
 * Skor kecocokan stem foto vs nama lengkap.
 * null = tidak cocok. Semakin tinggi semakin spesifik.
 */
export function scoreNamePhotoMatch(photoStem: string, fullName: string): number | null {
  const photo = normalizeNameTokens(photoStem);
  const name = normalizeNameTokens(fullName);
  if (photo.length === 0 || name.length === 0) return null;
  if (photo.length > name.length) return null;

  let score = 0;
  for (let i = 0; i < photo.length; i++) {
    const kind = tokenMatches(photo[i], name[i]);
    if (!kind) return null;
    if (kind === "exact") score += 20;
    else if (kind === "prefix") score += 12;
    else score += 4; // initial
    score += Math.min(photo[i].length, 12);
  }

  // Prefer foto yang menutupi lebih banyak bagian nama
  score += photo.length * 1000;
  // Bonus jika jumlah token sama (nama file ≈ nama lengkap)
  if (photo.length === name.length) score += 500;
  // Prefer stem lebih panjang (lebih spesifik) saat skor mirip
  score += Math.min(photoStem.trim().length, 80);

  return score;
}

export type PhotoMatchInput = {
  path: string;
  stem: string;
  data: Buffer;
};

export type PhotoMatchRow = {
  name: string;
  nisn?: string | null;
  /** Diisi jika berhasil dicocokkan. */
  photoData?: string;
};

/**
 * Pasangkan foto ke baris:
 * 1) NISN persis (jika kolom nisn & nama file = NISN)
 * 2) Nama (dukung singkatan/inisial); ambil skor tertinggi unik
 */
export function assignPhotosToRows<T extends PhotoMatchRow>(
  rows: T[],
  photos: PhotoMatchInput[],
  toPhotoData: (buf: Buffer) => { photoData: string } | { error: string }
): {
  photoErrors: { file: string; message: string }[];
  unmatchedPhotos: string[];
} {
  const photoErrors: { file: string; message: string }[] = [];
  const unmatchedPhotos: string[] = [];
  const usedPhoto = new Set<number>();

  const apply = (rowIdx: number, photoIdx: number) => {
    const converted = toPhotoData(photos[photoIdx].data);
    if ("error" in converted) {
      photoErrors.push({ file: photos[photoIdx].path, message: converted.error });
      usedPhoto.add(photoIdx);
      return;
    }
    rows[rowIdx].photoData = converted.photoData;
    usedPhoto.add(photoIdx);
  };

  // Pass 1: NISN exact
  for (let pi = 0; pi < photos.length; pi++) {
    const stem = photos[pi].stem.trim();
    if (!stem) continue;
    const hits: number[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      if (rows[ri].photoData) continue;
      const nisn = rows[ri].nisn?.trim();
      if (nisn && nisn === stem) hits.push(ri);
    }
    if (hits.length === 1) apply(hits[0], pi);
    else if (hits.length > 1) {
      photoErrors.push({
        file: photos[pi].path,
        message: `NISN ${stem} cocok ke lebih dari satu baris — tidak dipasangkan`,
      });
      usedPhoto.add(pi);
    }
  }

  // Pass 2: nama — foto lebih panjang dulu agar lebih spesifik
  const photoOrder = photos
    .map((_, i) => i)
    .filter((i) => !usedPhoto.has(i))
    .sort((a, b) => photos[b].stem.length - photos[a].stem.length || a - b);

  for (const pi of photoOrder) {
    if (usedPhoto.has(pi)) continue;
    const stem = photos[pi].stem;
    const candidates: { ri: number; score: number }[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      if (rows[ri].photoData) continue;
      const score = scoreNamePhotoMatch(stem, rows[ri].name || "");
      if (score != null) candidates.push({ ri, score });
    }
    if (candidates.length === 0) {
      unmatchedPhotos.push(stem);
      continue;
    }
    const best = Math.max(...candidates.map((c) => c.score));
    const winners = candidates.filter((c) => c.score === best);
    if (winners.length === 1) {
      apply(winners[0].ri, pi);
    } else {
      const names = winners
        .slice(0, 3)
        .map((w) => rows[w.ri].name)
        .join(", ");
      photoErrors.push({
        file: photos[pi].path,
        message: `Nama file ambigu (${winners.length} siswa mirip: ${names}${winners.length > 3 ? "…" : ""}) — tidak dipasangkan`,
      });
      usedPhoto.add(pi);
    }
  }

  return { photoErrors, unmatchedPhotos };
}
