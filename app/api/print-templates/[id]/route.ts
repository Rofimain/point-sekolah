import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { slugifyPrintTemplate } from "@/lib/print-templates";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.printTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const data: { title?: string; slug?: string; body?: string; sortOrder?: number } = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Judul surat wajib diisi" }, { status: 400 });
    data.title = title;
  }

  if (body.slug !== undefined) {
    const slug = typeof body.slug === "string" ? slugifyPrintTemplate(body.slug) : "";
    if (!slug) return NextResponse.json({ error: "Slug tidak valid" }, { status: 400 });
    if (slug !== existing.slug) {
      const clash = await prisma.printTemplate.findUnique({ where: { slug } });
      if (clash) {
        return NextResponse.json({ error: "Slug sudah dipakai template lain" }, { status: 400 });
      }
    }
    data.slug = slug;
  }

  if (body.body !== undefined) {
    if (typeof body.body !== "string") {
      return NextResponse.json({ error: "Isi template harus teks" }, { status: 400 });
    }
    data.body = body.body;
  }

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Urutan tidak valid" }, { status: 400 });
    }
    data.sortOrder = Math.trunc(n);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  const updated = await prisma.printTemplate.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.printTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }

  await prisma.printTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
