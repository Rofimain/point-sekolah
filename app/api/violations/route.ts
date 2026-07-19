import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { violationNameSortOrder } from "@/lib/violation-name";
import { recordDataAccessLog } from "@/lib/access-log";

export async function GET() {
  const violations = await prisma.violationType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { points: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(violations);
}

export async function POST(req: NextRequest) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;
  const body = await req.json();
  const { name, category, points, description, section } = body;
  if (!name || !category || points === undefined || points === null || points === "") {
    return NextResponse.json({ error: "Field wajib kurang" }, { status: 400 });
  }
  const nameStr = String(name).trim();
  const vt = await prisma.violationType.create({
    data: {
      name: nameStr,
      category,
      points: parseInt(points, 10),
      description: description || null,
      section: section || null,
      sortOrder: violationNameSortOrder(nameStr),
      active: true,
    },
  });
  await recordDataAccessLog({
    session,
    action: "VIOLATION_CREATE",
    summary: `Tambah jenis pelanggaran ${vt.name}`,
    targetType: "ViolationType",
    targetId: vt.id,
    meta: { points: vt.points, category: vt.category },
  });
  return NextResponse.json(vt, { status: 201 });
}
