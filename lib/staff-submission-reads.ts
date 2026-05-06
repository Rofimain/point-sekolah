const STORAGE_KEY = "svs-staff-student-submission-read-ids";

export function loadStaffSubmissionReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function persistStaffSubmissionReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

/** Hapus ID yang tidak lagi ada di daftar server agar storage tidak membengkak. */
export function pruneStaffSubmissionReadIds(validIds: Set<string>) {
  const current = loadStaffSubmissionReadIds();
  const toRemove = Array.from(current).filter((id) => !validIds.has(id));
  if (toRemove.length === 0) return current;
  for (const id of toRemove) current.delete(id);
  persistStaffSubmissionReadIds(current);
  return current;
}
