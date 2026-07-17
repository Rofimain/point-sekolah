import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createViolationEvidencePdf, evidencePdfFilename } from "@/lib/violation-evidence-pdf";
import { canReadViolationRecord } from "@/lib/record-access";
import { listRecordEvidenceImageData } from "@/lib/record-evidence-images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.violationRecord.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      points: true,
      session: true,
      notes: true,
      date: true,
      createdAt: true,
      createdByName: true,
      evidenceImageData: true,
      studentSignatureData: true,
      student: {
        select: { name: true, nisn: true, class: { select: { name: true } } },
      },
      violationType: { select: { name: true } },
    },
  });
  if (!record) return NextResponse.json({ error: "Catatan tidak ditemukan" }, { status: 404 });
  if (!canReadViolationRecord(session.user, record.studentId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const evidenceImages = await listRecordEvidenceImageData(id);
    const pdf = await createViolationEvidencePdf({
      ...record,
      evidenceImages,
      evidenceImageData: evidenceImages[0] ?? record.evidenceImageData,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${evidencePdfFilename(record.student.name, record.id)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[evidence-pdf] gagal membuat PDF", error);
    return NextResponse.json({ error: "Bukti tidak dapat dibuat karena data gambar tidak valid." }, { status: 422 });
  }
}
