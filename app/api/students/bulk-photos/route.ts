import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { recordDataAccessLog } from "@/lib/access-log";
import { runBulkStudentPhotoUpdate } from "@/lib/students-bulk-photo-update";
import { prisma } from "@/lib/prisma";

const MAX_ZIP_BYTES = 40 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "File kosong atau tidak valid" }, { status: 400 });
  }

  const name = (file instanceof File ? file.name : "").toLowerCase();
  const isZip =
    name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
  if (!isZip) {
    return NextResponse.json({ error: "Unggah file .zip berisi foto (.jpg/.jpeg/.png)" }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json({ error: "ZIP terlalu besar (maks. 40 MB)" }, { status: 413 });
  }

  const classIdRaw = form.get("classId")?.toString()?.trim() || "";
  let classId: string | undefined;
  if (classIdRaw) {
    const cls = await prisma.class.findUnique({ where: { id: classIdRaw }, select: { id: true } });
    if (!cls) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 400 });
    classId = cls.id;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const result = await runBulkStudentPhotoUpdate({ zipBuf: buf, classId });
    await recordDataAccessLog({
      session,
      action: "STUDENT_BULK_PHOTO_UPDATE",
      summary: `Update foto massal: ${result.updated} siswa diperbarui`,
      targetType: "User",
      meta: {
        updated: result.updated,
        unmatched: result.unmatchedPhotos.length,
        classId: classId ?? null,
      },
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[students/bulk-photos]", e);
    const msg = e instanceof Error ? e.message : "Gagal memperbarui foto.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
