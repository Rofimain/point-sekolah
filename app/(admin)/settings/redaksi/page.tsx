import { Prisma } from "@/generated/prisma/client";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { DEFAULT_PRINT_TEMPLATES } from "@/lib/print-templates";
import RedaksiClient from "./RedaksiClient";

function isPrintTemplateTableMissing(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2021" &&
    (e.meta as { modelName?: string } | undefined)?.modelName === "PrintTemplate"
  );
}

async function ensureDefaultTemplates() {
  try {
    const count = await prisma.printTemplate.count();
    if (count > 0) return;
    await prisma.printTemplate.createMany({
      data: DEFAULT_PRINT_TEMPLATES.map((t) => ({
        slug: t.slug,
        title: t.title,
        body: t.body,
        sortOrder: t.sortOrder,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    if (isPrintTemplateTableMissing(e)) return;
    // Unique race saat dua request seed bersamaan — abaikan
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

export default async function RedaksiPage() {
  const session = await getSafeServerSession();
  if (!canManageData(session?.user?.role)) redirect("/dashboard");

  await ensureDefaultTemplates();

  let initial: Awaited<ReturnType<typeof prisma.printTemplate.findMany>> = [];
  try {
    initial = await prisma.printTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  } catch (e) {
    if (!isPrintTemplateTableMissing(e)) throw e;
  }

  return <RedaksiClient initial={initial} />;
}
