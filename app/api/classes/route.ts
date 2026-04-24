import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classes = await prisma.class.findMany({
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, grade, major, year } = body;
  if (!name || !grade || !year) return NextResponse.json({ error: "Name, grade, year required" }, { status: 400 });

  const cls = await prisma.class.create({ data: { name, grade, major: major || "", year } });
  return NextResponse.json({ class: cls }, { status: 201 });
}
