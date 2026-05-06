import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { role?: string; search?: string; page?: string; classId?: string };
}) {
  const session = await getSafeServerSession();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const page = parseInt(searchParams.page || "1");
  const perPage = 20;
  const where: any = {};
  if (searchParams.role) where.role = searchParams.role;
  if (searchParams.search) where.name = { contains: searchParams.search, mode: "insensitive" };
  if (searchParams.classId) where.classId = searchParams.classId;

  const [rawUsers, total, classes, superAdminTotal, activeSuperAdminCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        nisn: true,
        nip: true,
        parentTelegram: true,
        classId: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        class: true,
        parentTelegramLinkToken: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
    prisma.user.count({ where: { role: "SUPER_ADMIN", active: true } }),
  ]);

  const users = rawUsers.map(({ parentTelegramLinkToken, ...u }) => ({
    ...u,
    ortuTelegramStatus:
      u.role === "STUDENT"
        ? u.parentTelegram?.trim()
          ? ("connected" as const)
          : parentTelegramLinkToken
            ? ("pending" as const)
            : ("none" as const)
        : null,
  }));

  return (
    <UsersClient
      users={users}
      total={total}
      page={page}
      perPage={perPage}
      classes={classes}
      searchParams={searchParams}
      superAdminTotal={superAdminTotal}
      activeSuperAdminCount={activeSuperAdminCount}
    />
  );
}
