import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runBulkStudentImport, type BulkStudentRow } from "@/lib/students-bulk-run";

function staffOk(role: string | undefined) {
  return role === "TEACHER" || role === "SUPER_ADMIN";
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
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Impor gagal";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
