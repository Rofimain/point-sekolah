/** Sort daftar Data siswa (server + URL query). */

export const STUDENTS_LIST_SORT_KEYS = ["name", "points"] as const;
export type StudentsListSortKey = (typeof STUDENTS_LIST_SORT_KEYS)[number];
export type StudentsListSortDir = "asc" | "desc";

export type StudentsListSort = {
  key: StudentsListSortKey;
  direction: StudentsListSortDir;
};

const DEFAULT_SORT: StudentsListSort = { key: "name", direction: "asc" };

export function parseStudentsListSort(
  sort?: string | null,
  dir?: string | null
): StudentsListSort {
  const key = STUDENTS_LIST_SORT_KEYS.includes(sort as StudentsListSortKey)
    ? (sort as StudentsListSortKey)
    : DEFAULT_SORT.key;
  const direction: StudentsListSortDir =
    dir === "asc" || dir === "desc" ? dir : key === "points" ? "desc" : DEFAULT_SORT.direction;
  return { key, direction };
}

/** Default arah saat user pertama kali klik kolom. */
export function defaultDirForStudentsSortKey(key: StudentsListSortKey): StudentsListSortDir {
  return key === "points" ? "desc" : "asc";
}

export function nextStudentsListSort(
  current: StudentsListSort,
  clicked: StudentsListSortKey
): StudentsListSort {
  if (current.key === clicked) {
    return { key: clicked, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key: clicked, direction: defaultDirForStudentsSortKey(clicked) };
}

export type StudentsListSortRow = {
  id: string;
  name: string;
  points: number;
};

export function compareStudentsListRows(
  a: StudentsListSortRow,
  b: StudentsListSortRow,
  sort: StudentsListSort
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let compared = 0;
  if (sort.key === "points") compared = a.points - b.points;
  else compared = a.name.localeCompare(b.name, "id", { sensitivity: "base" });

  if (compared !== 0) return compared * direction;
  const byName = a.name.localeCompare(b.name, "id", { sensitivity: "base" });
  return byName || a.id.localeCompare(b.id);
}

export function sortStudentsListRows<T extends StudentsListSortRow>(
  rows: T[],
  sort: StudentsListSort
): T[] {
  return [...rows].sort((a, b) => compareStudentsListRows(a, b, sort));
}
