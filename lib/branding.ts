export const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME?.trim() || "SMA ISLAM AL AZHAR 1 JAKARTA";

/**
 * Nama pendek untuk label TTD (mirip master Word: "Kepala SMA Islam Al Azhar 1").
 * Hindari wrap di kolom tanda tangan 3 kolom.
 */
export const SCHOOL_NAME_SHORT =
  process.env.NEXT_PUBLIC_SCHOOL_NAME_SHORT?.trim() || "SMA Islam Al Azhar 1";
