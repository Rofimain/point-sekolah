import type { Prisma } from "@/generated/prisma/client";

/**
 * Catatan yang boleh tampil di UI operasional:
 * belum soft-delete, dan siswanya belum dihapus dari daftar pengguna.
 */
export function visibleViolationRecordWhere(
  extra?: Prisma.ViolationRecordWhereInput
): Prisma.ViolationRecordWhereInput {
  if (!extra) {
    return {
      deletedAt: null,
      student: { deletedAt: null },
    };
  }

  const { student: extraStudent, ...rest } = extra;
  const studentExtra =
    extraStudent && typeof extraStudent === "object" && !Array.isArray(extraStudent)
      ? (extraStudent as Prisma.UserWhereInput)
      : {};

  return {
    ...rest,
    deletedAt: null,
    student: {
      ...studentExtra,
      deletedAt: null,
    },
  };
}
