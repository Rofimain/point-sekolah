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

/** YYYY-MM-DD dari instant Date pada zona waktu tertentu. */
export function dateInTimeZoneYmd(d: Date | string, timeZone: string = TZ): string {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return calendarTodayYmd(timeZone);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(x);
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

/** Selisih hari kalender (YYYY-MM-DD) — later − earlier. */
export function calendarDaysBetweenYmd(earlierYmd: string, laterYmd: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(earlierYmd.trim());
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(laterYmd.trim());
  if (!a || !b) return Number.NaN;
  const t0 = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const t1 = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.floor((t1 - t0) / 86_400_000);
}

/**
 * Berapa hari kalender sejak tanggal KEJADIAN pelanggaran (field `date`),
 * sampai "hari ini" di zona sekolah — bukan tanggal input (`createdAt`).
 */
export function calendarDaysSinceIncident(
  incidentDate: Date | string,
  now: Date = new Date(),
  timeZone: string = TZ
): number {
  const incidentYmd = dateToYmdInput(incidentDate);
  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return calendarDaysBetweenYmd(incidentYmd, todayYmd);
}
