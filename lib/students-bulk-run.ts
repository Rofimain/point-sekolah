import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  buildStudentCreateInput,
  isDefaultStudentPasswordConfigError,
  resolveDefaultStudentPassword,
  resolveStudentEmail,
} from "@/lib/student-upsert";
import { parseUserPhotoInput } from "@/lib/user-photo";
import { validateNewPassword } from "@/lib/password-policy";

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";

export type BulkStudentRow = {
  name: string;
  /** Opsional — data tambahan, bukan syarat login. */
  nisn?: string;
  classId?: string;
  className?: string;
  /** Wajib untuk login (atau kosong + NISN untuk email otomatis). */
  email?: string;
  password?: string;
  /** Data-URL JPEG/PNG untuk foto profil (opsional). */
  photoData?: string;
};

export type BulkImportResult = {
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
  truncatedErrors: boolean;
  /** Cara ortu dapat Telegram setelah impor bulk (webhook + tautan per siswa) */
  telegramOrtuNote: string;
};

const BULK_TELEGRAM_ORTU_NOTE =
  "Setiap siswa mendapat token tautan Telegram otomatis. Super Admin: Manajemen Pengguna → siswa → Salin tautan Telegram ortu; kirim ke ortu. Ortu buka link lalu Start — webhook menyimpan chat ID.";

export async function runBulkStudentImport(
  rows: BulkStudentRow[],
  opts?: { defaultPassword?: string }
): Promise<BulkImportResult> {
  if (rows.length === 0) {
    return {
      created: 0,
      failed: 0,
      errors: [],
      truncatedErrors: false,
      telegramOrtuNote: BULK_TELEGRAM_ORTU_NOTE,
    };
  }
  if (rows.length > 500) {
    throw new Error("Maksimal 500 baris per unggahan");
  }

  const classes = await prisma.class.findMany();
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

  const errors: { row: number; message: string }[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    try {
      const name = r.name?.trim();
      const nisn = r.nisn?.trim() || "";
      if (!name) {
        errors.push({ row: rowNum, message: "Nama kosong" });
        continue;
      }

      let classId = r.classId?.trim();
      const cn = r.className?.trim();
      if (!classId && cn) {
        const found = classes.find((c) => c.name.toLowerCase() === cn.toLowerCase());
        if (!found) {
          errors.push({ row: rowNum, message: `Kelas "${cn}" tidak ditemukan` });
          continue;
        }
        classId = found.id;
      }
      if (!classId) {
        errors.push({ row: rowNum, message: "Kelas wajib (kolom nama_kelas atau id_kelas)" });
        continue;
      }
      if (!classes.some((c) => c.id === classId)) {
        errors.push({ row: rowNum, message: "ID kelas tidak valid" });
        continue;
      }

      if (nisn) {
        const nisnDup = await prisma.user.findFirst({ where: { nisn } });
        if (nisnDup) {
          errors.push({ row: rowNum, message: "NISN sudah terdaftar" });
          continue;
        }
      }

      const emailResolved = resolveStudentEmail({
        email: r.email,
        nisn: nisn || null,
        domain: STUDENT_DOMAIN,
      });
      if (!emailResolved.ok) {
        errors.push({ row: rowNum, message: emailResolved.error });
        continue;
      }
      const email = emailResolved.email;

      const mailDup = await prisma.user.findUnique({ where: { email } });
      if (mailDup) {
        errors.push({ row: rowNum, message: `Email ${email} sudah dipakai` });
        continue;
      }

      const pwdRow = r.password?.trim();
      const pwd = (pwdRow || pwdDefaultCheck.value).slice(0, 72);
      const pwdCheck = validateNewPassword(pwd);
      if (!pwdCheck.ok) {
        errors.push({ row: rowNum, message: pwdCheck.error });
        continue;
      }
      const hashed = pwdRow ? await bcrypt.hash(pwdCheck.value, 12) : hashedDefault;

      let photoData: string | null = null;
      let photoPresent = false;
      if (r.photoData?.trim()) {
        const photo = parseUserPhotoInput(r.photoData);
        if ("error" in photo) {
          errors.push({ row: rowNum, message: photo.error });
          continue;
        }
        photoData = photo.photoData;
        photoPresent = photo.photoPresent;
      }

      await prisma.user.create({
        data: buildStudentCreateInput({
          name,
          nisn: nisn || null,
          classId,
          email,
          hashedPassword: hashed,
          photoData,
          photoPresent,
        }),
      });
      created++;
    } catch (e: unknown) {
      console.error("[students-bulk-run] row", rowNum, e);
      errors.push({ row: rowNum, message: "Gagal menyimpan baris ini." });
    }
  }

  return {
    created,
    failed: errors.length,
    errors: errors.slice(0, 50),
    truncatedErrors: errors.length > 50,
    telegramOrtuNote: BULK_TELEGRAM_ORTU_NOTE,
  };
}
