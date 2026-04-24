import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function staffOk(role: string | undefined) {
  return role === "TEACHER" || role === "SUPER_ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const classes = await prisma.class.findMany({
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, grade, major, year } = body as { name?: string; grade?: string; major?: string; year?: string };
  const n = name?.trim();
  const g = grade?.trim();
  const y = year?.trim();
  if (!n || !g || !y) {
    return NextResponse.json({ error: "Nama kelas, tingkat (angkatan), dan tahun ajaran wajib diisi" }, { status: 400 });
  }

  const cls = await prisma.class.create({
    data: { name: n, grade: g, major: (major?.trim() || "") || "", year: y },
  });
  revalidateTag("sidebar-classes");
  return NextResponse.json({ class: cls }, { status: 201 });
}
