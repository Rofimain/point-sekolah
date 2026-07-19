import type { Prisma } from "@/generated/prisma/client";
import { newParentLinkToken } from "@/lib/parent-telegram-link";
import { parseParentTelegramForDb } from "@/lib/parent-telegram-field";

/**
 * Password default siswa dari environment.
 * Production: wajib DEFAULT_STUDENT_PASSWORD (tanpa fallback hardcoded).
 * Development/test: fallback lokal hanya jika env kosong.
 */
export function resolveDefaultStudentPassword(): string {
  const fromEnv = process.env.DEFAULT_STUDENT_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DEFAULT_STUDENT_PASSWORD wajib diisi di environment production.");
  }
  return "Siswa@123456";
}

/** @deprecated Gunakan resolveDefaultStudentPassword() — nilai di-resolve saat dipanggil. */
export const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD?.trim() || "Siswa@123456";

export function studentEmailFromNisn(nisn: string, domain: string): string {
  const local = nisn.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!local) throw new Error("NISN tidak valid untuk membuat email");
  return `${local}@${domain}`;
}

export function normalizeStudentEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmailShape(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Resolve email siswa: wajib isi email, atau (jika kosong) otomatis dari NISN.
 * Login utama = email; NISN hanya data tambahan.
 */
export function resolveStudentEmail(opts: {
  email?: string | null;
  nisn?: string | null;
  domain: string;
}): { ok: true; email: string } | { ok: false; error: string } {
  const email = normalizeStudentEmail(opts.email ?? "");
  if (email) {
    if (!isValidEmailShape(email)) return { ok: false, error: "Format email tidak valid" };
    return { ok: true, email };
  }
  const nisn = opts.nisn?.trim() || "";
  if (!nisn) {
    return { ok: false, error: "Email wajib diisi (atau isi NISN untuk membuat email otomatis)" };
  }
  try {
    return { ok: true, email: studentEmailFromNisn(nisn, opts.domain) };
  } catch {
    return { ok: false, error: "NISN tidak valid untuk email otomatis" };
  }
}

export function buildStudentCreateInput(input: {
  name: string;
  nisn?: string | null;
  classId: string;
  email: string;
  hashedPassword: string;
  parentTelegram?: string | null;
  photoData?: string | null;
  photoPresent?: boolean;
}): Prisma.UserCreateInput {
  const tg = parseParentTelegramForDb(input.parentTelegram ?? undefined);
  if (!tg.ok) throw new Error(tg.error);
  const hasPhoto = Boolean(input.photoPresent && input.photoData);
  const nisn = input.nisn?.trim() || null;
  return {
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    password: input.hashedPassword,
    role: "STUDENT",
    nisn,
    parentTelegram: tg.value,
    parentTelegramLinkToken: newParentLinkToken(),
    class: { connect: { id: input.classId } },
    active: true,
    status: "ACTIVE",
    createdFrom: "MANUAL",
    photoData: hasPhoto ? input.photoData! : null,
    photoPresent: hasPhoto,
  };
}
