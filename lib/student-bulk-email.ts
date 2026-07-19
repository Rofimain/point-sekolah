import {
  isValidEmailShape,
  normalizeStudentEmail,
} from "@/lib/student-upsert";
import { getStudentEmailDomain, isConfiguredDomain } from "@/lib/school-config";
import { isGoogleEmailDomainAllowed } from "@/lib/google-auth-messages";

/** Nama sementara dari local-part email bila kolom nama kosong saat create. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || "";
  const spaced = local
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "Siswa";
  return spaced
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Email bulk siswa harus domain sekolah (student domain / allowlist auth). */
export function isBulkStudentEmailAllowed(email: string): boolean {
  const normalized = normalizeStudentEmail(email);
  if (!isValidEmailShape(normalized)) return false;
  const studentDomain = getStudentEmailDomain();
  if (isConfiguredDomain(studentDomain)) {
    return normalized.endsWith(`@${studentDomain.toLowerCase()}`);
  }
  return isGoogleEmailDomainAllowed(normalized);
}
