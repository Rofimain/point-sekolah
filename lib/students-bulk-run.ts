import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  buildStudentCreateInput,
  isDefaultStudentPasswordConfigError,
  resolveDefaultStudentPassword,
  resolveStudentEmail,
} from "@/lib/student-upsert";
import { getStudentEmailDomain } from "@/lib/school-config";
import { parseUserPhotoInput } from "@/lib/user-photo";
import { validateNewPassword } from "@/lib/password-policy";
import { displayNameFromEmail, isBulkStudentEmailAllowed } from "@/lib/student-bulk-email";

export type BulkStudentRow = {
  name: string;
  /** Opsional — data tambahan, bukan syarat login. */
  nisn?: string;
  classId?: string;
  className?: string;
  /** Kunci upsert: email domain sekolah (atau kosong + NISN → email otomatis). */
  email?: string;
  password?: string;
  /** Data-URL JPEG/PNG untuk foto profil (opsional). */
  photoData?: string;
};

export type BulkImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; message: string }[];
  truncatedErrors: boolean;
  /** Cara ortu dapat Telegram setelah impor bulk (webhook + tautan per siswa) */
  telegramOrtuNote: string;
};

const BULK_TELEGRAM_ORTU_NOTE =
  "Setiap siswa mendapat token tautan Telegram otomatis. Super Admin: Manajemen Pengguna → siswa → Salin tautan Telegram ortu; kirim ke ortu. Ortu buka link lalu Start — webhook menyimpan chat ID.";

function resolveClassId(
  r: BulkStudentRow,
  classes: { id: string; name: string }[]
): { ok: true; classId: string | null } | { ok: false; error: string } {
  let classId = r.classId?.trim() || "";
  const cn = r.className?.trim();
  if (!classId && cn) {
    const found = classes.find((c) => c.name.toLowerCase() === cn.toLowerCase());
    if (!found) return { ok: false, error: `Kelas "${cn}" tidak ditemukan` };
    classId = found.id;
  }
  if (!classId) return { ok: true, classId: null };
  if (!classes.some((c) => c.id === classId)) return { ok: false, error: "ID kelas tidak valid" };
  return { ok: true, classId };
}

/**
 * Bulk siswa: upsert by email.
 * - Email baru (domain sekolah) → create (nama boleh dari email; kelas opsional).
 * - Email sudah ada → update field yang diisi (kelas, nama, NISN, foto, password).
 */
export async function runBulkStudentImport(
  rows: BulkStudentRow[],
  opts?: { defaultPassword?: string }
): Promise<BulkImportResult> {
  if (rows.length === 0) {
    return {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      truncatedErrors: false,
      telegramOrtuNote: BULK_TELEGRAM_ORTU_NOTE,
    };
  }
  if (rows.length > 500) {
    throw new Error("Maksimal 500 baris per unggahan");
  }

  const classes = await prisma.class.findMany({ select: { id: true, name: true } });
  let pwdDefaultRaw: string;
  try {
    pwdDefaultRaw = (opts?.defaultPassword?.trim() || resolveDefaultStudentPassword()).slice(0, 72);
  } catch (e) {
    if (isDefaultStudentPasswordConfigError(e)) throw e;
    throw e;
  }
  const pwdDefaultCheck = validateNewPassword(pwdDefaultRaw);
  if (!pwdDefaultCheck.ok) {
    throw new Error(pwdDefaultCheck.error);
  }
  const hashedDefault = await bcrypt.hash(pwdDefaultCheck.value, 12);

  const existingUsers = await prisma.user.findMany({
    where: { role: "STUDENT", deletedAt: null },
    select: { id: true, email: true, nisn: true },
  });
  const byEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));
  const byNisn = new Map(
    existingUsers.filter((u) => u.nisn).map((u) => [u.nisn as string, u] as const)
  );
  /** Email/NISN yang dipakai baris sebelumnya dalam batch yang sama (create). */
  const batchEmails = new Set<string>();
  const batchNisn = new Set<string>();

  const errors: { row: number; message: string }[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    try {
      const nameRaw = r.name?.trim() || "";
      const nisn = r.nisn?.trim() || "";

      const emailResolved = resolveStudentEmail({
        email: r.email,
        nisn: nisn || null,
        domain: getStudentEmailDomain(),
      });
      if (!emailResolved.ok) {
        errors.push({ row: rowNum, message: emailResolved.error });
        continue;
      }
      const email = emailResolved.email;

      if (!isBulkStudentEmailAllowed(email)) {
        errors.push({
          row: rowNum,
          message: `Email harus memakai domain sekolah (${getStudentEmailDomain()})`,
        });
        continue;
      }

      const classResolved = resolveClassId(r, classes);
      if (!classResolved.ok) {
        errors.push({ row: rowNum, message: classResolved.error });
        continue;
      }
      const classId = classResolved.classId;

      let photoData: string | null | undefined;
      let photoPresent: boolean | undefined;
      if (r.photoData?.trim()) {
        const photo = parseUserPhotoInput(r.photoData);
        if ("error" in photo) {
          errors.push({ row: rowNum, message: photo.error });
          continue;
        }
        photoData = photo.photoData;
        photoPresent = photo.photoPresent;
      }

      const existing = byEmail.get(email.toLowerCase());

      if (existing) {
        if (nisn) {
          const nisnOwner = byNisn.get(nisn);
          if (nisnOwner && nisnOwner.id !== existing.id) {
            errors.push({ row: rowNum, message: `NISN ${nisn} sudah dipakai siswa lain` });
            continue;
          }
        }

        const data: Record<string, unknown> = {};
        if (nameRaw) data.name = nameRaw;
        if (classId) data.classId = classId;
        if (nisn) data.nisn = nisn;
        if (photoPresent && photoData) {
          data.photoData = photoData;
          data.photoPresent = true;
        }

        const pwdRow = r.password?.trim();
        if (pwdRow) {
          const pwdCheck = validateNewPassword(pwdRow.slice(0, 72));
          if (!pwdCheck.ok) {
            errors.push({ row: rowNum, message: pwdCheck.error });
            continue;
          }
          data.password = await bcrypt.hash(pwdCheck.value, 12);
          data.passwordChangedAt = null;
          data.authVersion = { increment: 1 };
          data.failedLoginCount = 0;
          data.lockedUntil = null;
        }

        if (Object.keys(data).length === 0) {
          // Email cocok tapi tidak ada field untuk diubah — anggap sukses (no-op update)
          updated++;
          continue;
        }

        await prisma.user.update({ where: { id: existing.id }, data });
        if (nisn) {
          if (existing.nisn) byNisn.delete(existing.nisn);
          byNisn.set(nisn, { ...existing, nisn });
        }
        updated++;
        continue;
      }

      // —— Create ——
      if (batchEmails.has(email.toLowerCase())) {
        errors.push({ row: rowNum, message: `Email ${email} duplikat di file yang sama` });
        continue;
      }
      if (nisn && (byNisn.has(nisn) || batchNisn.has(nisn))) {
        errors.push({ row: rowNum, message: "NISN sudah terdaftar" });
        continue;
      }

      const name = nameRaw || displayNameFromEmail(email);
      const pwdRow = r.password?.trim();
      const pwd = (pwdRow || pwdDefaultCheck.value).slice(0, 72);
      const pwdCheck = validateNewPassword(pwd);
      if (!pwdCheck.ok) {
        errors.push({ row: rowNum, message: pwdCheck.error });
        continue;
      }
      const hashed = pwdRow ? await bcrypt.hash(pwdCheck.value, 12) : hashedDefault;

      const createdUser = await prisma.user.create({
        data: buildStudentCreateInput({
          name,
          nisn: nisn || null,
          classId,
          email,
          hashedPassword: hashed,
          photoData: photoData ?? null,
          photoPresent: photoPresent ?? false,
        }),
        select: { id: true, email: true, nisn: true },
      });
      byEmail.set(email.toLowerCase(), createdUser);
      batchEmails.add(email.toLowerCase());
      if (createdUser.nisn) {
        byNisn.set(createdUser.nisn, createdUser);
        batchNisn.add(createdUser.nisn);
      }
      created++;
    } catch (e: unknown) {
      console.error("[students-bulk-run] row", rowNum, e);
      errors.push({ row: rowNum, message: "Gagal menyimpan baris ini." });
    }
  }

  return {
    created,
    updated,
    failed: errors.length,
    errors: errors.slice(0, 50),
    truncatedErrors: errors.length > 50,
    telegramOrtuNote: BULK_TELEGRAM_ORTU_NOTE,
  };
}
