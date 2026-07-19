import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { slugifyPrintTemplate } from "@/lib/print-templates";
import { DEFAULT_PAGE_SETTINGS, serializePageSettings, parsePageSettings } from "@/lib/document-page";
import { plainTextToDocumentHtml } from "@/lib/document-html";
import { sanitizeDocumentHtml } from "@/lib/sanitize-document-html";
import { recordDataAccessLog } from "@/lib/access-log";

export async function GET() {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;

  const rows = await prisma.printTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Judul surat wajib diisi" }, { status: 400 });
  }

  const requestedSlug =
    typeof body.slug === "string" && body.slug.trim() ? slugifyPrintTemplate(body.slug) : slugifyPrintTemplate(title);

  let slug = requestedSlug;
  const existing = await prisma.printTemplate.findUnique({ where: { slug } });
  if (existing) {
    slug = `${requestedSlug}-${Date.now().toString(36)}`;
  }

  const templateBody =
    typeof body.body === "string" ? sanitizeDocumentHtml(plainTextToDocumentHtml(body.body)) : "<p></p>";
  const pageSettings =
    body.pageSettings != null
      ? typeof body.pageSettings === "string"
        ? serializePageSettings(parsePageSettings(body.pageSettings))
        : serializePageSettings(parsePageSettings(JSON.stringify(body.pageSettings)))
      : serializePageSettings(DEFAULT_PAGE_SETTINGS);
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
      pageSettings,
      sortOrder,
    },
  });

  await recordDataAccessLog({
    session,
    action: "TEMPLATE_CREATE",
    summary: `Tambah template surat ${created.title}`,
    targetType: "PrintTemplate",
    targetId: created.id,
  });

  return NextResponse.json(created, { status: 201 });
}
