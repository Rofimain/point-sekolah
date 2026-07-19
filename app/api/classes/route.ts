import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";
import { recordDataAccessLog } from "@/lib/access-log";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const classes = await prisma.class.findMany({
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const body = await req.json();
  const { name, grade, major, year } = body as { name?: string; grade?: string; major?: string; year?: string };
  const n = name?.trim();
  const g = grade?.trim();
  const y = year?.trim();
  if (!n || !g || !y) {
    return NextResponse.json(
      { error: "Nama kelas, tingkat (angkatan), dan tahun ajaran wajib diisi" },
      { status: 400 }
    );
  }

  const cls = await prisma.class.create({
    data: { name: n, grade: g, major: major?.trim() || "" || "", year: y },
  });
  revalidateTag("sidebar-classes", { expire: 0 });
  await recordDataAccessLog({
    session,
    action: "CLASS_CREATE",
    summary: `Tambah kelas ${cls.name}`,
    targetType: "Class",
    targetId: cls.id,
  });
  return NextResponse.json({ class: cls }, { status: 201 });
}
