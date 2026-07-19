import type { Prisma } from "@/generated/prisma/client";
import { newParentLinkToken } from "@/lib/parent-telegram-link";
import { parseParentTelegramForDb } from "@/lib/parent-telegram-field";

/** Pesan jelas ke admin/ops bila DEFAULT_STUDENT_PASSWORD belum di-set di production. */
export const DEFAULT_STUDENT_PASSWORD_MISSING_MSG =
  "DEFAULT_STUDENT_PASSWORD belum diatur di environment production (ENV_FILE_CONTENT / GitHub Secrets). " +
  "Tambahkan variabel ini, deploy ulang, lalu coba lagi. " +
  "Tanpa password default, pembuatan/impor siswa tidak bisa dilanjutkan.";

/**
 * Password default siswa dari environment.
 * Production: wajib DEFAULT_STUDENT_PASSWORD (tanpa fallback hardcoded).
 * Development/test: fallback lokal hanya jika env kosong.
 */
export function resolveDefaultStudentPassword(): string {
  const fromEnv = process.env.DEFAULT_STUDENT_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(DEFAULT_STUDENT_PASSWORD_MISSING_MSG);
  }
  return "Siswa@123456";
}

export function isDefaultStudentPasswordConfigError(e: unknown): boolean {
  return e instanceof Error && e.message.includes("DEFAULT_STUDENT_PASSWORD");
}

/** @deprecated Gunakan resolveDefaultStudentPassword() — nilai di-resolve saat dipanggil. */
export const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD?.trim() || "Siswa@123456";

export function studentEmailFromNisn(nisn: string, domain: string): string {
  const local = nisn
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
  const domain = opts.domain?.trim() || "";
  if (!domain || domain.includes("Belum Diatur") || domain.startsWith("[")) {
    return {
      ok: false,
      error:
        "NEXT_PUBLIC_STUDENT_DOMAIN belum diatur — tidak bisa membuat email otomatis dari NISN. Isi email siswa secara manual atau set domain di environment build.",
    };
  }
  try {
    return { ok: true, email: studentEmailFromNisn(nisn, domain) };
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
    /** Password dari admin/default → wajib diganti saat login credentials pertama kali. */
    passwordChangedAt: null,
    photoData: hasPhoto ? input.photoData! : null,
    photoPresent: hasPhoto,
  };
}
