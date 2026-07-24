/** Pilihan SESI / JAM PELAJARAN untuk form catatan (siswa & staf). */
export const SESSION_SLOTS = [
  "Jam 0",
  "Jam 1-2",
  "Jam 3-4",
  "Jam 5-6",
  "Jam 7-8",
  "Istirahat / Umum",
] as const;

export type SessionSlot = (typeof SESSION_SLOTS)[number];
