import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { slugifyPrintTemplate } from "@/lib/print-templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.printTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Judul surat wajib diisi" }, { status: 400 });
  }

  const requestedSlug =
    typeof body.slug === "string" && body.slug.trim()
      ? slugifyPrintTemplate(body.slug)
      : slugifyPrintTemplate(title);

  let slug = requestedSlug;
  const existing = await prisma.printTemplate.findUnique({ where: { slug } });
  if (existing) {
    slug = `${requestedSlug}-${Date.now().toString(36)}`;
  }

  const templateBody = typeof body.body === "string" ? body.body : "";
  const maxSort = await prisma.printTemplate.aggregate({ _max: { sortOrder: true } });
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.trunc(body.sortOrder)
      : (maxSort._max.sortOrder ?? 0) + 10;

  const created = await prisma.printTemplate.create({
    data: {
      title,
      slug,
      body: templateBody,
      sortOrder,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
