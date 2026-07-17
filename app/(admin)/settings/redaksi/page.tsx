import { Prisma } from "@/generated/prisma/client";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { DEFAULT_PRINT_TEMPLATES, PRINT_TEMPLATES_LAYOUT_VERSION } from "@/lib/print-templates";
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

    for (const t of DEFAULT_PRINT_TEMPLATES) {
      await prisma.printTemplate.upsert({
        where: { slug: t.slug },
        create: {
          slug: t.slug,
          title: t.title,
          body: t.body,
          sortOrder: t.sortOrder,
        },
        // Satu kali refresh layout default; template kustom (slug lain) tidak tersentuh.
        update: needsLayoutRefresh
          ? { title: t.title, body: t.body, sortOrder: t.sortOrder }
          : {},
      });
    }

    if (needsLayoutRefresh) {
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
