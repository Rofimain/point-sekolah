/** Zona waktu untuk batas "hari ini" dan tanggal default (sekolah di Indonesia). */
const TZ = process.env.NEXT_PUBLIC_INCIDENT_TIMEZONE || "Asia/Jakarta";

export function calendarTodayYmd(timeZone: string = TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Parse input tanggal kejadian (YYYY-MM-DD). Disimpan sebagai UTC noon agar hari kalender stabil.
 */
export function parseIncidentDateYmd(
  input: string,
  timeZone: string = TZ
): { ok: true; date: Date } | { ok: false; error: string } {
  const s = input.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { ok: false, error: "Format tanggal tidak valid." };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { ok: false, error: "Tanggal tidak valid." };
  const trial = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (trial.getUTCFullYear() !== y || trial.getUTCMonth() !== mo - 1 || trial.getUTCDate() !== d) {
    return { ok: false, error: "Tanggal tidak valid." };
  }
  const today = calendarTodayYmd(timeZone);
  if (s > today) return { ok: false, error: "Tanggal pelanggaran tidak boleh di masa depan." };
  if (s < "2015-01-01") return { ok: false, error: "Tanggal terlalu lama (minimum 2015)." };
  return { ok: true, date: trial };
}

/** Kosong = gunakan hari ini (zona sekolah). */
export function parseOptionalIncidentDate(
  input: unknown,
  timeZone: string = TZ
): { ok: true; date: Date } | { ok: false; error: string } {
  if (input == null || String(input).trim() === "") {
    return parseIncidentDateYmd(calendarTodayYmd(timeZone), timeZone);
  }
  return parseIncidentDateYmd(String(input), timeZone);
}

/** Untuk isian `<input type="date" />` dari nilai record (disimpan UTC noon). */
export function dateToYmdInput(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return calendarTodayYmd();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(x);
}
