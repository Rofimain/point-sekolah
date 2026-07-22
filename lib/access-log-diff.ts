/** Helper detail untuk AccessLog: jenis login & diff kolom (tanpa menyimpan rahasia). */

export type LoginIdentifierKind = "email" | "nisn" | "nip" | "unknown";

export function classifyLoginIdentifier(
  identifier: string | null | undefined,
  provider: string
): LoginIdentifierKind {
  const id = (identifier ?? "").trim();
  if (!id) return "unknown";
  if (id.includes("@") || provider === "google") return "email";
  if (provider === "student-login") return "nisn";
  if (provider === "admin-login") return "nip";
  return "unknown";
}

/** Label metode login untuk ringkasan manusia. */
export function loginMethodLabel(provider: string, kind: LoginIdentifierKind): string {
  if (provider === "google") return "Google";
  if (kind === "email") return "email + password";
  if (kind === "nisn") return "NISN + password";
  if (kind === "nip") return "NIP + password";
  if (provider === "student-login" || provider === "admin-login") return "username + password";
  return provider;
}

export type FieldChange = {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
};

const USER_FIELD_LABELS: Record<string, string> = {
  name: "Nama",
  email: "Email",
  role: "Role",
  status: "Status",
  active: "Aktif",
  nisn: "NISN",
  nip: "NIP",
  jabatan: "Jabatan",
  classId: "Kelas",
  lastAcademicYear: "Tahun ajaran terakhir",
  password: "Password",
  photoPresent: "Foto profil",
  parentTelegram: "Telegram ortu",
};

const REDACTED_FIELDS = new Set(["password", "photoData", "parentTelegramLinkToken"]);

function displayScalar(field: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (REDACTED_FIELDS.has(field)) return "(diubah)";
  if (field === "photoPresent") return value ? "ada" : "tidak ada";
  if (typeof value === "boolean") return value ? "ya" : "tidak";
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

export function userFieldLabel(field: string): string {
  return USER_FIELD_LABELS[field] || field;
}

/**
 * Bandingkan snapshot user sebelum/sesudah update.
 * `passwordChanged` / perubahan foto dilaporkan tanpa menyimpan hash atau data-URL.
 */
export function buildUserFieldChanges(opts: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  passwordChanged?: boolean;
  photoChanged?: boolean;
}): FieldChange[] {
  const keys = new Set<string>([...Object.keys(opts.before), ...Object.keys(opts.after)]);
  const skip = new Set([
    "password",
    "photoData",
    "photoPresent",
    "parentTelegramLinkToken",
    "authVersion",
    "updatedAt",
    "createdAt",
  ]);
  const changes: FieldChange[] = [];

  for (const field of keys) {
    if (skip.has(field)) continue;
    const fromRaw = opts.before[field];
    const toRaw = opts.after[field];
    const from = displayScalar(field, fromRaw);
    const to = displayScalar(field, toRaw);
    if (from === to) continue;
    // Hindari noise null→null
    if (from == null && to == null) continue;
    changes.push({
      field,
      label: userFieldLabel(field),
      from,
      to,
    });
  }

  if (opts.passwordChanged) {
    changes.push({
      field: "password",
      label: userFieldLabel("password"),
      from: "(tersembunyi)",
      to: "(direset / diganti)",
    });
  }

  if (opts.photoChanged) {
    const beforePresent = Boolean(opts.before.photoPresent);
    const afterPresent = Boolean(opts.after.photoPresent);
    let toLabel = "diganti";
    if (!beforePresent && afterPresent) toLabel = "ditambahkan";
    else if (beforePresent && !afterPresent) toLabel = "dihapus";
    changes.push({
      field: "photoPresent",
      label: "Foto profil",
      from: beforePresent ? "ada" : "tidak ada",
      to: toLabel,
    });
  }

  return changes;
}

/** Ringkas daftar perubahan untuk kolom summary (max ~chars). */
export function formatChangesSummary(changes: FieldChange[], maxChars = 280): string {
  if (changes.length === 0) return "";
  const parts = changes.map((c) => {
    if (c.field === "password") return `${c.label}: diganti`;
    if (c.field === "photoPresent") return `${c.label}: ${c.to}`;
    const from = c.from ?? "—";
    const to = c.to ?? "—";
    return `${c.label}: ${from} → ${to}`;
  });
  let out = parts.join("; ");
  if (out.length > maxChars) out = `${out.slice(0, maxChars - 1)}…`;
  return out;
}
