import { prisma } from "@/lib/prisma";
import ViolationsClient from "./ViolationsClient";

export default async function ViolationsPage() {
  const violations = await prisma.violationType.findMany({ orderBy: [{ category: "asc" }, { points: "asc" }] });
  return <ViolationsClient violations={violations} />;
}
