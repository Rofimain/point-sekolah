import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  buildStudentCreateInput,
  DEFAULT_STUDENT_PASSWORD,
  studentEmailFromNisn,
} from "@/lib/student-upsert";
import { parseUserPhotoInput } from "@/lib/user-photo";
import { validateNewPassword } from "@/lib/password-policy";

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";

export type BulkStudentRow = {
  name: string;
  nisn: string;
  classId?: string;
  className?: string;
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
  const pwdDefaultRaw = (opts?.defaultPassword?.trim() || DEFAULT_STUDENT_PASSWORD).slice(0, 72);
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
      const nisn = r.nisn?.trim();
      if (!name || !nisn) {
        errors.push({ row: rowNum, message: "Nama atau NISN kosong" });
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

      const nisnDup = await prisma.user.findFirst({ where: { nisn } });
      if (nisnDup) {
        errors.push({ row: rowNum, message: "NISN sudah terdaftar" });
        continue;
      }

      let email = r.email?.trim().toLowerCase() || "";
      if (!email) {
        try {
          email = studentEmailFromNisn(nisn, STUDENT_DOMAIN);
        } catch {
          errors.push({ row: rowNum, message: "NISN tidak valid untuk email otomatis" });
          continue;
        }
      }

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
          nisn,
          classId,
          email,
          hashedPassword: hashed,
          photoData,
          photoPresent,
        }),
      });
      created++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      errors.push({ row: rowNum, message: msg });
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
