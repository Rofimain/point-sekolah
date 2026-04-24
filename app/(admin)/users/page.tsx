import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export default async function UsersPage({ searchParams }: { searchParams: { role?: string; search?: string; page?: string } }) {
  const session = await getSafeServerSession();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const page = parseInt(searchParams.page || "1");
  const perPage = 20;
  const where: any = {};
  if (searchParams.role) where.role = searchParams.role;
  if (searchParams.search) where.name = { contains: searchParams.search, mode: "insensitive" };

  const [users, total, classes] = await Promise.all([
    prisma.user.findMany({ where, include: { class: true }, orderBy: [{ role: "asc" }, { name: "asc" }], skip: (page - 1) * perPage, take: perPage }),
    prisma.user.count({ where }),
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
  ]);

  return <UsersClient users={users} total={total} page={page} perPage={perPage} classes={classes} searchParams={searchParams} />;
}
