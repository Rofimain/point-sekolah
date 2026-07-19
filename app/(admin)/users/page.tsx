import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";
import { APP_ROLES, canManageUsers } from "@/lib/staff-roles";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; search?: string; page?: string; classId?: string }>;
}) {
  const query = await searchParams;
  const session = await getSafeServerSession();
  if (!canManageUsers(session?.user?.role)) redirect("/dashboard");

  const page = parseInt(query.page || "1");
  const perPage = 20;
  const where: any = { deletedAt: null };
  if (query.role && (APP_ROLES as readonly string[]).includes(query.role)) {
    where.role = query.role;
  }
  if (query.search) where.name = { contains: query.search, mode: "insensitive" };
  // Filter kelas hanya untuk siswa
  if (query.classId && query.role === "STUDENT") {
    where.classId = query.classId;
  }

  const [rawUsers, total, classes, superAdminTotal, activeSuperAdminCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }, { id: "asc" }],
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
        status: true,
        googleSub: true,
        authProvider: true,
        photoPresent: true,
        createdAt: true,
        updatedAt: true,
        class: true,
        parentTelegramLinkToken: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.user.count({ where: { role: "SUPER_ADMIN", status: { not: "LEFT" }, deletedAt: null } }),
    prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null } }),
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
      searchParams={query}
      superAdminTotal={superAdminTotal}
      activeSuperAdminCount={activeSuperAdminCount}
      viewerRole={session!.user.role}
      viewerId={session!.user.id}
    />
  );
}
