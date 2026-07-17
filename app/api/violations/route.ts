import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";

export async function GET() {
  const violations = await prisma.violationType.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { points: "asc" }],
  });
  return NextResponse.json(violations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, category, points, description, section } = body;
  if (!name || !category || points === undefined || points === null || points === "") {
    return NextResponse.json({ error: "Field wajib kurang" }, { status: 400 });
  }
  const vt = await prisma.violationType.create({
    data: {
      name,
      category,
      points: parseInt(points, 10),
      description: description || null,
      section: section || null,
    },
  });
  return NextResponse.json(vt, { status: 201 });
}
