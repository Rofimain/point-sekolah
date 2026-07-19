import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseStudentImportPackage } from "@/lib/parse-student-import-package";
import { runBulkStudentImport } from "@/lib/students-bulk-run";
import { canManageData } from "@/lib/staff-roles";
import { recordDataAccessLog } from "@/lib/access-log";

function staffOk(role: string | undefined) {
  return canManageData(role);
}

/** .xlsx saja ~8 MB; paket ZIP + foto hingga 40 MB. */
const MAX_XLSX_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_BYTES = 40 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "File kosong atau tidak valid" }, { status: 400 });
  }

  const name = (file instanceof File ? file.name : "").toLowerCase();
  const isZip = name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
  const maxBytes = isZip ? MAX_ZIP_BYTES : MAX_XLSX_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: isZip ? "ZIP terlalu besar (maks. 40 MB)" : "File terlalu besar (maks. 8 MB)" },
      { status: 400 }
    );
  }

  const defaultPassword = form.get("defaultPassword")?.toString();
  const buf = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseStudentImportPackage(buf);
  } catch (e: unknown) {
    console.error("[students/import-file] parse gagal:", e);
    return NextResponse.json(
      { error: "Gagal membaca file. Pastikan format .xlsx atau .zip valid." },
      { status: 400 }
    );
  }

  try {
    const result = await runBulkStudentImport(parsed.rows, { defaultPassword });
    await recordDataAccessLog({
      session,
      action: "STUDENT_FILE_IMPORT",
      summary: `Impor file siswa: ${result.created} berhasil, ${result.failed} gagal`,
      targetType: "User",
      meta: {
        created: result.created,
        failed: result.failed,
        photosAttached: parsed.rows.filter((r) => r.photoData).length,
        isZip,
      },
    });
    return NextResponse.json({
      ...result,
      photosAttached: parsed.rows.filter((r) => r.photoData).length,
      unmatchedPhotos: parsed.unmatchedPhotos.slice(0, 20),
      photoErrors: parsed.photoErrors.slice(0, 20),
    });
  } catch (e: unknown) {
    console.error("[students/import-file] import gagal:", e);
    return NextResponse.json({ error: "Impor gagal. Periksa data dan coba lagi." }, { status: 400 });
  }
}
