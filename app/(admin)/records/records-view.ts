import type { Prisma } from "@prisma/client";

export type RecordsRow =
  | { type: "record"; record: Prisma.ViolationRecordGetPayload<{ include: { student: { include: { class: true } }; violationType: true } }> }
  | { type: "placeholder"; student: Prisma.UserGetPayload<{ include: { class: true } }> };
