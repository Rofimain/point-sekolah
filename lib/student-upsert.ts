import type { Prisma } from "@/generated/prisma/client";
import { newParentLinkToken } from "@/lib/parent-telegram-link";
import { parseParentTelegramForDb } from "@/lib/parent-telegram-field";

export const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || "Siswa@1234";

export function studentEmailFromNisn(nisn: string, domain: string): string {
  const local = nisn.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!local) throw new Error("NISN tidak valid untuk membuat email");
  return `${local}@${domain}`;
}

export function buildStudentCreateInput(input: {
  name: string;
  nisn: string;
  classId: string;
  email: string;
  hashedPassword: string;
  parentTelegram?: string | null;
}): Prisma.UserCreateInput {
  const tg = parseParentTelegramForDb(input.parentTelegram ?? undefined);
  if (!tg.ok) throw new Error(tg.error);
  return {
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    password: input.hashedPassword,
    role: "STUDENT",
    nisn: input.nisn.trim(),
    parentTelegram: tg.value,
    parentTelegramLinkToken: newParentLinkToken(),
    class: { connect: { id: input.classId } },
    active: true,
  };
}
