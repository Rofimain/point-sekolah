import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { slugifyPrintTemplate } from "@/lib/print-templates";
import { serializePageSettings, parsePageSettings, type DocumentPageSettings } from "@/lib/document-page";
import { plainTextToDocumentHtml } from "@/lib/document-html";
import { sanitizeDocumentHtml } from "@/lib/sanitize-document-html";
import { recordDataAccessLog } from "@/lib/access-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const existing = await prisma.printTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const data: {
    title?: string;
    slug?: string;
    body?: string;
    pageSettings?: string | null;
    sortOrder?: number;
  } = {};

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
      return NextResponse.json({ error: "Isi template harus teks/HTML" }, { status: 400 });
    }
    data.body = sanitizeDocumentHtml(plainTextToDocumentHtml(body.body));
  }

  if (body.pageSettings !== undefined) {
    if (body.pageSettings === null) {
      data.pageSettings = null;
    } else if (typeof body.pageSettings === "string") {
      data.pageSettings = serializePageSettings(parsePageSettings(body.pageSettings));
    } else if (typeof body.pageSettings === "object") {
      data.pageSettings = serializePageSettings(
        parsePageSettings(JSON.stringify(body.pageSettings as DocumentPageSettings))
      );
    } else {
      return NextResponse.json({ error: "pageSettings tidak valid" }, { status: 400 });
    }
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
  await recordDataAccessLog({
    session,
    action: "TEMPLATE_UPDATE",
    summary: `Ubah template surat ${updated.title}`,
    targetType: "PrintTemplate",
    targetId: updated.id,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const existing = await prisma.printTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }

  await prisma.printTemplate.delete({ where: { id } });
  await recordDataAccessLog({
    session,
    action: "TEMPLATE_DELETE",
    summary: `Hapus template surat ${existing.title}`,
    targetType: "PrintTemplate",
    targetId: existing.id,
  });
  return NextResponse.json({ ok: true });
}
