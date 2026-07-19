import { getSchoolName, getSchoolNameShort } from "@/lib/school-config";

export const SCHOOL_NAME = getSchoolName();

/**
 * Nama pendek untuk label TTD.
 * Hindari wrap di kolom tanda tangan 3 kolom.
 */
export const SCHOOL_NAME_SHORT = getSchoolNameShort();
