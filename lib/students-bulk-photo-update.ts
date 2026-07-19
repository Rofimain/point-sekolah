import { prisma } from "@/lib/prisma";
import { extractPhotosFromZip } from "@/lib/extract-photos-from-zip";
import { assignPhotosToRows } from "@/lib/student-photo-match";
import { imageBufferToPhotoDataUrl } from "@/lib/user-photo";
import { ACTIVE_USER_WHERE } from "@/lib/user-status";

export type BulkPhotoUpdateResult = {
  updated: number;
  photoErrors: { file: string; message: string }[];
  unmatchedPhotos: string[];
  truncatedErrors: boolean;
};

const MAX_PHOTOS = 500;

/**
 * Update foto siswa yang sudah ada dari ZIP.
 * Matching sama impor: NISN exact, lalu nama (boleh disingkat/inisial).
 */
export async function runBulkStudentPhotoUpdate(opts: {
  zipBuf: Buffer;
  classId?: string;
}): Promise<BulkPhotoUpdateResult> {
  const { photos, photoErrors: extractErrors } = await extractPhotosFromZip(opts.zipBuf);
  if (photos.length > MAX_PHOTOS) {
    throw new Error(`Maksimal ${MAX_PHOTOS} foto per unggahan`);
  }

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...ACTIVE_USER_WHERE,
      ...(opts.classId ? { classId: opts.classId } : {}),
    },
    select: { id: true, name: true, nisn: true },
    orderBy: { name: "asc" },
  });

  if (students.length === 0) {
    return {
      updated: 0,
      photoErrors: [
        ...extractErrors,
        {
          file: "(daftar siswa)",
          message: opts.classId
            ? "Tidak ada siswa aktif di kelas yang dipilih"
            : "Tidak ada siswa aktif untuk dipasangkan foto",
        },
      ].slice(0, 50),
      unmatchedPhotos: photos.map((p) => p.stem).slice(0, 50),
      truncatedErrors: extractErrors.length > 50 || photos.length > 50,
    };
  }

  type Row = { id: string; name: string; nisn?: string | null; photoData?: string };
  const rows: Row[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    nisn: s.nisn,
  }));

  const matched = assignPhotosToRows(rows, photos, (buf) => {
    const r = imageBufferToPhotoDataUrl(buf);
    if ("error" in r) return { error: r.error };
    return { photoData: r.photoData };
  });

  const toUpdate = rows.filter((r) => r.photoData);
  for (const row of toUpdate) {
    await prisma.user.update({
      where: { id: row.id },
      data: {
        photoData: row.photoData!,
        photoPresent: true,
      },
    });
  }

  const allErrors = [...extractErrors, ...matched.photoErrors];
  return {
    updated: toUpdate.length,
    photoErrors: allErrors.slice(0, 50),
    unmatchedPhotos: matched.unmatchedPhotos.slice(0, 50),
    truncatedErrors: allErrors.length > 50 || matched.unmatchedPhotos.length > 50,
  };
}
