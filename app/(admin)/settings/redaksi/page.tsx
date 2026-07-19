import { Prisma } from "@/generated/prisma/client";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { DEFAULT_PRINT_TEMPLATES, PRINT_TEMPLATES_LAYOUT_VERSION } from "@/lib/print-templates";
import { plainTextToDocumentHtml } from "@/lib/document-html";
import { DEFAULT_PAGE_SETTINGS, serializePageSettings } from "@/lib/document-page";
import RedaksiClient from "./RedaksiClient";

const LAYOUT_VERSION_KEY = "print_templates_layout_v";

function isPrintTemplateTableMissing(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2021" &&
    (e.meta as { modelName?: string } | undefined)?.modelName === "PrintTemplate"
  );
}

async function syncDefaultTemplates() {
  try {
    const versionRow = await prisma.appSetting.findUnique({ where: { key: LAYOUT_VERSION_KEY } });
    const needsLayoutRefresh = versionRow?.value !== PRINT_TEMPLATES_LAYOUT_VERSION;
    const defaultPage = serializePageSettings(DEFAULT_PAGE_SETTINGS);

    for (const t of DEFAULT_PRINT_TEMPLATES) {
      const htmlBody = plainTextToDocumentHtml(t.body);
      await prisma.printTemplate.upsert({
        where: { slug: t.slug },
        create: {
          slug: t.slug,
          title: t.title,
          body: htmlBody,
          pageSettings: defaultPage,
          sortOrder: t.sortOrder,
        },
        update: needsLayoutRefresh
          ? { title: t.title, body: htmlBody, pageSettings: defaultPage, sortOrder: t.sortOrder }
          : {},
      });
    }

    // Migrate legacy plain-text bodies once when layout version bumps.
    if (needsLayoutRefresh) {
      const all = await prisma.printTemplate.findMany();
      for (const row of all) {
        const looksPlain = !/<\/?(p|div|h[1-6]|span)\b/i.test(row.body);
        if (looksPlain || !row.pageSettings) {
          await prisma.printTemplate.update({
            where: { id: row.id },
            data: {
              body: looksPlain ? plainTextToDocumentHtml(row.body) : row.body,
              pageSettings: row.pageSettings || defaultPage,
            },
          });
        }
      }

      await prisma.appSetting.upsert({
        where: { key: LAYOUT_VERSION_KEY },
        update: { value: PRINT_TEMPLATES_LAYOUT_VERSION },
        create: { key: LAYOUT_VERSION_KEY, value: PRINT_TEMPLATES_LAYOUT_VERSION },
      });
    }
  } catch (e) {
    if (isPrintTemplateTableMissing(e)) return;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

export default async function RedaksiPage() {
  const session = await getSafeServerSession();
  if (!canManageData(session?.user?.role)) redirect("/dashboard");

  await syncDefaultTemplates();

  let initial: Awaited<ReturnType<typeof prisma.printTemplate.findMany>> = [];
  try {
    initial = await prisma.printTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  } catch (e) {
    if (!isPrintTemplateTableMissing(e)) throw e;
  }

  return (
    <RedaksiClient
      key={initial.map((t) => `${t.id}:${String(t.updatedAt)}`).join("|")}
      initial={initial}
    />
  );
}
