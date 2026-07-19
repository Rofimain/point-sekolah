import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runBulkStudentImport, type BulkStudentRow } from "@/lib/students-bulk-run";
import { canManageData } from "@/lib/staff-roles";
import { recordDataAccessLog } from "@/lib/access-log";

function staffOk(role: string | undefined) {
  return canManageData(role);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { rows, defaultPassword } = body as { rows: BulkStudentRow[]; defaultPassword?: string };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris data" }, { status: 400 });
  }

  try {
    const result = await runBulkStudentImport(rows, { defaultPassword });
    await recordDataAccessLog({
      session,
      action: "STUDENT_BULK_IMPORT",
      summary: `Impor bulk siswa: ${result.created} berhasil, ${result.failed} gagal`,
      targetType: "User",
      meta: { created: result.created, failed: result.failed, rows: rows.length },
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Impor gagal";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
