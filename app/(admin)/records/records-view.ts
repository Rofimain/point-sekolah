import type { Prisma } from "@prisma/client";

/** Daftar catatan tanpa kolom bukti besar (foto / tanda tangan) untuk performa UI. */
export const RECORD_LIST_SELECT = {
  id: true,
  studentId: true,
  violationTypeId: true,
  session: true,
  notes: true,
  points: true,
  date: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
  student: { include: { class: true } },
  violationType: true,
} as const satisfies Prisma.ViolationRecordSelect;

export type ViolationRecordListItem = Prisma.ViolationRecordGetPayload<{ select: typeof RECORD_LIST_SELECT }>;

export type RecordsRow =
  | { type: "record"; record: ViolationRecordListItem }
  | { type: "placeholder"; student: Prisma.UserGetPayload<{ include: { class: true } }> };
