import { Prisma } from "@/generated/prisma/client";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { syncDefaultTemplates } from "@/lib/sync-print-templates";
import RedaksiClient from "./RedaksiClient";

function isPrintTemplateTableMissing(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2021" &&
    (e.meta as { modelName?: string } | undefined)?.modelName === "PrintTemplate"
  );
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

  return <RedaksiClient key={initial.map((t) => `${t.id}:${String(t.updatedAt)}`).join("|")} initial={initial} />;
}
