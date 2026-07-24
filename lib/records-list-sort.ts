/** Sort daftar Catatan Siswa (server + URL query + export). */

export const RECORDS_LIST_SORT_KEYS = ["name", "violation", "date", "points"] as const;
export type RecordsListSortKey = (typeof RECORDS_LIST_SORT_KEYS)[number];
export type RecordsListSortDir = "asc" | "desc";

export type RecordsListSort = {
  key: RecordsListSortKey;
  direction: RecordsListSortDir;
};

/** Default halaman: tanggal pelanggaran terbaru. */
export const DEFAULT_RECORDS_LIST_SORT: RecordsListSort = { key: "date", direction: "desc" };

export function parseRecordsListSort(sort?: string | null, dir?: string | null): RecordsListSort {
  const key = RECORDS_LIST_SORT_KEYS.includes(sort as RecordsListSortKey)
    ? (sort as RecordsListSortKey)
    : DEFAULT_RECORDS_LIST_SORT.key;
  const direction: RecordsListSortDir =
    dir === "asc" || dir === "desc"
      ? dir
      : key === "date" || key === "points"
        ? "desc"
        : "asc";
  return { key, direction };
}

export function defaultDirForRecordsSortKey(key: RecordsListSortKey): RecordsListSortDir {
  return key === "date" || key === "points" ? "desc" : "asc";
}

export function nextRecordsListSort(current: RecordsListSort, clicked: RecordsListSortKey): RecordsListSort {
  if (current.key === clicked) {
    return { key: clicked, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key: clicked, direction: defaultDirForRecordsSortKey(clicked) };
}

export function recordsSortLabel(sort: RecordsListSort): string {
  const dir =
    sort.key === "name" || sort.key === "violation"
      ? sort.direction === "asc"
        ? "A–Z"
        : "Z–A"
      : sort.key === "date"
        ? sort.direction === "desc"
          ? "terbaru"
          : "terlama"
        : sort.direction === "desc"
          ? "besar→kecil"
          : "kecil→besar";
  const col =
    sort.key === "name"
      ? "nama"
      : sort.key === "violation"
        ? "pelanggaran"
        : sort.key === "date"
          ? "tanggal pelanggaran"
          : "total poin";
  return `urut ${col} ${dir}`;
}

export type RecordsListSortRow = {
  id: string;
  studentId: string;
  studentName: string;
  violationName: string;
  date: Date | string;
  totalPoints: number;
};

export function compareRecordsListRows(
  a: RecordsListSortRow,
  b: RecordsListSortRow,
  sort: RecordsListSort
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let compared = 0;
  if (sort.key === "points") compared = a.totalPoints - b.totalPoints;
  else if (sort.key === "date") {
    compared = new Date(a.date).getTime() - new Date(b.date).getTime();
  } else if (sort.key === "violation") {
    compared = a.violationName.localeCompare(b.violationName, "id", { sensitivity: "base" });
  } else {
    compared = a.studentName.localeCompare(b.studentName, "id", { sensitivity: "base" });
  }

  if (compared !== 0) return compared * direction;
  const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
  if (byDate !== 0) return byDate;
  return a.id.localeCompare(b.id);
}

export function sortRecordsListRows<T extends RecordsListSortRow>(rows: T[], sort: RecordsListSort): T[] {
  return [...rows].sort((a, b) => compareRecordsListRows(a, b, sort));
}

/** Urutan siswa di mode roster (satu baris per siswa sebelum di-expand). */
export type RecordsRosterSortStudent = {
  id: string;
  name: string;
  totalPoints: number;
  latestDate: Date | string | null;
  latestViolationName: string;
};

export function compareRecordsRosterStudents(
  a: RecordsRosterSortStudent,
  b: RecordsRosterSortStudent,
  sort: RecordsListSort
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let compared = 0;
  if (sort.key === "points") compared = a.totalPoints - b.totalPoints;
  else if (sort.key === "date") {
    const ta = a.latestDate ? new Date(a.latestDate).getTime() : 0;
    const tb = b.latestDate ? new Date(b.latestDate).getTime() : 0;
    compared = ta - tb;
  } else if (sort.key === "violation") {
    compared = a.latestViolationName.localeCompare(b.latestViolationName, "id", { sensitivity: "base" });
  } else {
    compared = a.name.localeCompare(b.name, "id", { sensitivity: "base" });
  }
  if (compared !== 0) return compared * direction;
  const byName = a.name.localeCompare(b.name, "id", { sensitivity: "base" });
  return byName || a.id.localeCompare(b.id);
}

export function sortRecordsRosterStudents<T extends RecordsRosterSortStudent>(
  rows: T[],
  sort: RecordsListSort
): T[] {
  return [...rows].sort((a, b) => compareRecordsRosterStudents(a, b, sort));
}
