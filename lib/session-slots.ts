/** Pilihan SESI / JAM PELAJARAN untuk form catatan (siswa & staf). */
export const SESSION_SLOTS = [
  "Jam 0",
  "Jam 1-2",
  "Jam 3-4",
  "Jam 5-6",
  "Jam 7-8",
  "Jam 9-10",
  "Istirahat / Umum",
  "Jam 1",
  "Jam 2",
  "Jam 3",
  "Jam 4",
  "Jam 5",
  "Jam 6",
  "Jam 7",
  "Jam 8",
  "Jam 9",
  "Jam 10",
] as const;

export type SessionSlot = (typeof SESSION_SLOTS)[number];
