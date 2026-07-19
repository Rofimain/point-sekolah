/** Placeholder jelas bila env branding/domain belum di-set (bukan nama/domain contoh palsu). */
export const UNSET_SCHOOL_NAME = "[Nama Sekolah Belum Diatur]";
export const UNSET_SCHOOL_NAME_SHORT = "[Nama Sekolah Belum Diatur]";
export const UNSET_STUDENT_DOMAIN = "[Domain Siswa Belum Diatur]";
export const UNSET_STAFF_DOMAIN = "[Domain Staf Belum Diatur]";

export function getSchoolName(): string {
  return process.env.NEXT_PUBLIC_SCHOOL_NAME?.trim() || UNSET_SCHOOL_NAME;
}

export function getSchoolNameShort(): string {
  return (
    process.env.NEXT_PUBLIC_SCHOOL_NAME_SHORT?.trim() ||
    process.env.NEXT_PUBLIC_SCHOOL_SHORT?.trim() ||
    getSchoolName()
  );
}

export function getStudentEmailDomain(): string {
  return process.env.NEXT_PUBLIC_STUDENT_DOMAIN?.trim() || UNSET_STUDENT_DOMAIN;
}

export function getStaffEmailDomain(): string {
  return process.env.NEXT_PUBLIC_STAFF_DOMAIN?.trim() || UNSET_STAFF_DOMAIN;
}

export function isConfiguredDomain(domain: string): boolean {
  const d = domain.trim();
  return Boolean(d) && !d.startsWith("[") && !d.includes("Belum Diatur");
}
