import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudentsClient from "./StudentsClient";
import type { Prisma } from "@prisma/client";

export default async function StudentsPage({ searchParams }: { searchParams: { search?: string; page?: string } }) {
  const session = await getSafeServerSession();
  if (!session?.user?.role || !["TEACHER", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const page = parseInt(searchParams.page || "1", 10);
  const perPage = 25;
  const where: Prisma.UserWhereInput = { role: "STUDENT" };
  if (searchParams.search?.trim()) {
    const q = searchParams.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nisn: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [students, total, classes] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { class: true },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
    prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }] }),
  ]);

  const studentDomain = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";

  return (
    <StudentsClient
      students={students}
      total={total}
      page={page}
      perPage={perPage}
      classes={classes}
      searchParams={searchParams}
      studentDomain={studentDomain}
      viewerRole={session.user.role}
    />
  );
}
