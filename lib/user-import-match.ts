/**
 * Matching user untuk import akademik tahunan.
 * Prioritas: id internal → NISN (siswa) → NIP (staf) → email.
 * Tidak auto-overwrite googleSub / tidak hard-delete.
 */

export type ImportUserRow = {
  id?: string | null;
  nisn?: string | null;
  nip?: string | null;
  email?: string | null;
  role?: string | null;
};

export type ExistingUserKey = {
  id: string;
  nisn?: string | null;
  nip?: string | null;
  email: string;
  status?: string | null;
};

export type MatchResult =
  | { kind: "match"; userId: string; via: "id" | "nisn" | "nip" | "email" }
  | { kind: "conflict"; reasons: string[] }
  | { kind: "create" };

function normEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || "";
}

function normId(value: string | null | undefined) {
  return value?.trim() || "";
}

export function matchImportUser(
  row: ImportUserRow,
  byId: Map<string, ExistingUserKey>,
  byNisn: Map<string, ExistingUserKey>,
  byNip: Map<string, ExistingUserKey>,
  byEmail: Map<string, ExistingUserKey>
): MatchResult {
  const id = normId(row.id);
  const nisn = normId(row.nisn);
  const nip = normId(row.nip);
  const email = normEmail(row.email);

  const hits: { userId: string; via: "id" | "nisn" | "nip" | "email" }[] = [];

  if (id && byId.has(id)) hits.push({ userId: byId.get(id)!.id, via: "id" });
  if (nisn && byNisn.has(nisn)) hits.push({ userId: byNisn.get(nisn)!.id, via: "nisn" });
  if (nip && byNip.has(nip)) hits.push({ userId: byNip.get(nip)!.id, via: "nip" });
  if (email && byEmail.has(email)) hits.push({ userId: byEmail.get(email)!.id, via: "email" });

  if (hits.length === 0) return { kind: "create" };

  const uniqueIds = [...new Set(hits.map((h) => h.userId))];
  if (uniqueIds.length > 1) {
    return {
      kind: "conflict",
      reasons: [
        `Baris cocok ke beberapa user berbeda: ${hits
          .map((h) => `${h.via}=${h.userId}`)
          .join(", ")}. Perlu review admin.`,
      ],
    };
  }

  const best = hits.sort((a, b) => {
    const order = { id: 0, nisn: 1, nip: 2, email: 3 } as const;
    return order[a.via] - order[b.via];
  })[0];

  return { kind: "match", userId: best.userId, via: best.via };
}

export function buildUserLookupMaps(users: ExistingUserKey[]) {
  const byId = new Map<string, ExistingUserKey>();
  const byNisn = new Map<string, ExistingUserKey>();
  const byNip = new Map<string, ExistingUserKey>();
  const byEmail = new Map<string, ExistingUserKey>();
  for (const u of users) {
    byId.set(u.id, u);
    if (u.nisn?.trim()) byNisn.set(u.nisn.trim(), u);
    if (u.nip?.trim()) byNip.set(u.nip.trim(), u);
    byEmail.set(normEmail(u.email), u);
  }
  return { byId, byNisn, byNip, byEmail };
}
