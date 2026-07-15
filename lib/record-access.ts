import { isStaffRole } from "@/lib/staff-roles";

export function canReadViolationRecord(
  viewer: { id: string; role: string },
  recordStudentId: string
) {
  return isStaffRole(viewer.role) || viewer.id === recordStudentId;
}
