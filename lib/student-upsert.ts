import type { Prisma } from "@prisma/client";
import { newParentLinkToken } from "@/lib/parent-telegram-link";

export const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || "Siswa@1234";

export function studentEmailFromNisn(nisn: string, domain: string): string {
  const local = nisn.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!local) throw new Error("NISN tidak valid untuk membuat email");
  return `${local}@${domain}`;
}

export function normalizeParentTelegram(raw: string | null | undefined): string | undefined {
  const t = raw?.trim();
  return t ? t : undefined;
}

export function buildStudentCreateInput(input: {
  name: string;
  nisn: string;
  classId: string;
  email: string;
  hashedPassword: string;
  parentTelegram?: string | null;
}): Prisma.UserCreateInput {
  return {
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    password: input.hashedPassword,
    role: "STUDENT",
    nisn: input.nisn.trim(),
    parentTelegram: normalizeParentTelegram(input.parentTelegram ?? undefined) ?? null,
    parentTelegramLinkToken: newParentLinkToken(),
    class: { connect: { id: input.classId } },
    active: true,
  };
}
