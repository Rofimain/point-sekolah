import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentFormClient from "./StudentFormClient";

export default async function StudentFormPage() {
  const session = await getSafeServerSession();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const violationTypes = await prisma.violationType.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { points: "asc" }],
  });

  const records = await prisma.violationRecord.findMany({
    where: { studentId: session.user.id },
    include: { violationType: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  const totalPoints = records.reduce((sum, r) => sum + r.points, 0);

  const student = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { class: true },
  });

  return (
    <StudentFormClient
      session={session}
      violationTypes={violationTypes}
      records={records}
      totalPoints={totalPoints}
      studentClass={student?.class?.name ?? null}
      studentNisn={student?.nisn ?? null}
    />
  );
}
