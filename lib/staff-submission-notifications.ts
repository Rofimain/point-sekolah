import { calendarTodayYmd } from "@/lib/incident-date";

export type StudentSubmissionNotification = {
  id: string;
  studentId: string;
  studentName: string;
  studentPhotoPresent: boolean;
  classLabel: string | null;
  violationName: string;
  points: number;
  incidentDate: string;
  createdAt: string;
  /** true = dari portal siswa; false = diinput staf (admin/guru/dll.) */
  submittedByStudent: boolean;
  createdByName: string | null;
};

export const STAFF_SUBMISSION_POLL_MS = 5000;
export const STAFF_SUBMISSION_POLL_HIDDEN_MS = 45000;
export const STAFF_SUBMISSION_NOTIFICATIONS_PATH =
  "/api/staff/student-submissions-notifications";

/** Label sumber input untuk lonceng / monitoring notifikasi. */
export function notificationSourceLabel(it: StudentSubmissionNotification): string {
  if (it.submittedByStudent) return "Portal siswa";
  return it.createdByName?.trim() ? `Staf · ${it.createdByName.trim()}` : "Staf";
}

/**
 * Awal hari kalender di zona sekolah (default Asia/Jakarta) sebagai Instant UTC.
 * Dipakai agar notifikasi otomatis hilang setelah berganti hari.
 */
export function startOfSchoolDay(): Date {
  const ymd = calendarTodayYmd();
  const [y, m, d] = ymd.split("-").map(Number);
  // Asia/Jakarta = UTC+7 tetap (tanpa DST) — selaras default NEXT_PUBLIC_INCIDENT_TIMEZONE
  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0));
}
