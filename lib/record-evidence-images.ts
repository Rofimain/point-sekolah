import { prisma } from "@/lib/prisma";

/** Ganti seluruh set foto bukti untuk satu catatan + sync kolom denormalisasi. */
export async function replaceRecordEvidenceImages(recordId: string, images: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.violationEvidenceImage.deleteMany({ where: { recordId } });
    if (images.length > 0) {
      await tx.violationEvidenceImage.createMany({
        data: images.map((imageData, sortOrder) => ({
          recordId,
          sortOrder,
          imageData,
        })),
      });
    }
    await tx.violationRecord.update({
      where: { id: recordId },
      data: {
        evidenceImageData: images[0] ?? null,
        evidenceImagePresent: images.length > 0,
      },
    });
  });
}

export async function listRecordEvidenceImageData(recordId: string): Promise<string[]> {
  const rows = await prisma.violationEvidenceImage.findMany({
    where: { recordId },
    orderBy: { sortOrder: "asc" },
    select: { imageData: true },
  });
  if (rows.length > 0) return rows.map((r) => r.imageData);

  const legacy = await prisma.violationRecord.findUnique({
    where: { id: recordId },
    select: { evidenceImageData: true },
  });
  const one = legacy?.evidenceImageData?.trim();
  return one ? [one] : [];
}
