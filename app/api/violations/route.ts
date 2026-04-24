import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const violations = await prisma.violationType.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { points: "asc" }] });
  return NextResponse.json(violations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, category, points, description } = body;
  if (!name || !category || !points) return NextResponse.json({ error: "Field wajib kurang" }, { status: 400 });
  const vt = await prisma.violationType.create({ data: { name, category, points: parseInt(points), description: description || null } });
  return NextResponse.json(vt, { status: 201 });
}
