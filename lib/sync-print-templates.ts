import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SCHOOL_NAME } from "@/lib/branding";
import {
  DEFAULT_PRINT_TEMPLATES,
  PRINT_TEMPLATES_LAYOUT_VERSION,
  migrateInfoPoinSignatory,
} from "@/lib/print-templates";
import { plainTextToDocumentHtml } from "@/lib/document-html";
import { DEFAULT_PAGE_SETTINGS, serializePageSettings } from "@/lib/document-page";

const LAYOUT_VERSION_KEY = "print_templates_layout_v";
const INFO_POIN_WALI_KELAS_KEY = "print_info_poin_wali_kelas_v1";

function isPrintTemplateTableMissing(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2021" &&
    (e.meta as { modelName?: string } | undefined)?.modelName === "PrintTemplate"
  );
}

/** Seed / refresh default surat, plus migrasi TTD info poin ke wali kelas. */
export async function syncDefaultTemplates() {
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

    await migrateInfoPoinWaliKelasOnce();
  } catch (e) {
    if (isPrintTemplateTableMissing(e)) return;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

async function migrateInfoPoinWaliKelasOnce() {
  const done = await prisma.appSetting.findUnique({ where: { key: INFO_POIN_WALI_KELAS_KEY } });
  if (done?.value === "1") return;

  const row = await prisma.printTemplate.findUnique({ where: { slug: "info-poin" } });
  if (row) {
    const next = migrateInfoPoinSignatory(row.body, SCHOOL_NAME);
    if (next !== row.body) {
      await prisma.printTemplate.update({ where: { id: row.id }, data: { body: next } });
    }
  }

  await prisma.appSetting.upsert({
    where: { key: INFO_POIN_WALI_KELAS_KEY },
    update: { value: "1" },
    create: { key: INFO_POIN_WALI_KELAS_KEY, value: "1" },
  });
}
