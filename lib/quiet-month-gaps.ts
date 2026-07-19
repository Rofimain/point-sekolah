import {
  calendarDaysBetweenYmd,
  dateInTimeZoneYmd,
} from "@/lib/incident-date";

export type QuietGap = {
  anchorYmd: string;
  nextYmd: string;
  daysQuiet: number;
};

/**
 * Jeda antar tanggal kejadian berurutan yang ≥ quietDays dan belum diklaim.
 * Pure — untuk unit test & catch-up.
 */
export function findUnclaimedQuietGaps(opts: {
  incidentYmds: string[];
  claimedAnchors: ReadonlySet<string>;
  quietDays: number;
}): QuietGap[] {
  const sorted = [...opts.incidentYmds]
    .map((y) => y.trim())
    .filter((y) => /^\d{4}-\d{2}-\d{2}$/.test(y))
    .sort();
  const out: QuietGap[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const anchorYmd = sorted[i]!;
    const nextYmd = sorted[i + 1]!;
    const daysQuiet = calendarDaysBetweenYmd(anchorYmd, nextYmd);
    if (!Number.isFinite(daysQuiet) || daysQuiet < opts.quietDays) continue;
    if (opts.claimedAnchors.has(anchorYmd)) continue;
    out.push({ anchorYmd, nextYmd, daysQuiet });
  }
  return out;
}

/** Apakah jendela “tenang sampai sekarang” sejak lastVio sudah diklaim. */
export function isLastWindowClaimed(opts: {
  lastVioYmd: string;
  claimedAnchors: ReadonlySet<string>;
  legacyQuietAdjustments: { createdAt: Date }[];
}): boolean {
  if (opts.claimedAnchors.has(opts.lastVioYmd)) return true;
  for (const adj of opts.legacyQuietAdjustments) {
    if (dateInTimeZoneYmd(adj.createdAt) >= opts.lastVioYmd) return true;
  }
  return false;
}
