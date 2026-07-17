import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { applyManualRemisiForStudent } from "@/lib/manual-remisi";
import { MANUAL_REMISI_TYPE, type ManualRemisiType } from "@/lib/remisi-rules";

const VALID_TYPES = new Set<string>(Object.values(MANUAL_REMISI_TYPE));

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!studentId) return NextResponse.json({ error: "Siswa wajib dipilih" }, { status: 400 });
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "Jenis remisi/reward tidak valid" }, { status: 400 });
  }

  const customPercent =
    body.customPercent != null && body.customPercent !== ""
      ? Number(body.customPercent)
      : undefined;
  const multiplier =
    body.multiplier != null && body.multiplier !== "" ? Number(body.multiplier) : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  const applied = await applyManualRemisiForStudent({
    studentId,
    type: type as ManualRemisiType,
    customPercent,
    multiplier,
    note,
  });

  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...applied.result });
}
