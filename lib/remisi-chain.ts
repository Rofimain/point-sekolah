import {
  isQuietMonthReason,
  isQuietMonthReversalReason,
  parseQuietMonthReason,
} from "@/lib/point-adjustment-reason";

export type RemisiIncident = { ymd: string; points: number };

export type RemisiAdjustmentInput = {
  id: string;
  reason: string;
  pointsDelta: number;
  effectiveYmd: string;
  createdYmd: string;
  reversalOfId: string | null;
};

export type RemisiToCreate = {
  anchorYmd: string;
  step: number;
  dueYmd: string;
  effectiveBefore: number;
  pointsDelta: number;
  isBackfill: boolean;
};

export type RemisiToReverse = {
  adjustmentId: string;
  anchorYmd: string;
  step: number;
  pointsDelta: number;
  sebab: string;
};

export type RemisiNext = {
  anchorYmd: string;
  step: number;
  dueYmd: string;
  estimatedDelta: number;
  effectiveNow: number;
};

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tambah n bulan kalender; hari yang tidak ada di bulan tujuan → hari terakhir. */
export function addMonthsClampYmd(ymd: string, n: number): string {
  const m = YMD.exec(ymd.trim());
  if (!m) return ymd;
  const y0 = Number(m[1]);
  const mo0 = Number(m[2]);
  const d0 = Number(m[3]);
  const idx = mo0 - 1 + n;
  const year = y0 + Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d0, last);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function stageCut(eff: number): number | null {
  if (eff <= 0) return null;
  const cut = Math.min(Math.ceil(eff * 0.25), eff);
  if (cut < 1) return null;
  return -cut;
}

function uniqueDates(incidents: RemisiIncident[]): string[] {
  return [...new Set(incidents.map((i) => i.ymd.trim()).filter((y) => YMD.test(y)))].sort();
}

function lastIncidentOnOrBefore(dates: string[], ymd: string): string | null {
  let found: string | null = null;
  for (const d of dates) {
    if (d <= ymd) found = d;
    else break;
  }
  return found;
}

type Expected = { anchorYmd: string; step: number; dueYmd: string };

function expectedStages(dates: string[], todayYmd: string): Expected[] {
  const out: Expected[] = [];
  for (let i = 0; i < dates.length; i++) {
    const anchorYmd = dates[i]!;
    const nx = dates[i + 1];
    for (let n = 1; n <= 120; n++) {
      const dueYmd = addMonthsClampYmd(anchorYmd, n);
      if (dueYmd <= anchorYmd) break;
      if (dueYmd > todayYmd) break;
      if (nx && nx < dueYmd) break;
      out.push({ anchorYmd, step: n, dueYmd });
    }
  }
  return out;
}

function sebabFor(anchorYmd: string, dueYmd: string, dates: string[]): string {
  if (!dates.includes(anchorYmd)) return "Data pelanggaran acuan berubah/dihapus";
  const breaker = dates.find((d) => d > anchorYmd && d < dueYmd);
  if (breaker) return `Ada pelanggaran tgl ${breaker}`;
  return "Data pelanggaran acuan berubah/dihapus";
}

type Claim = {
  id: string;
  anchorYmd: string;
  step: number;
  legacy: boolean;
  effectiveYmd: string;
  pointsDelta: number;
};

/**
 * Remisi otomatis yang jatuh tempo setelah suatu remisi manual.
 * Baris ini ikut dihitung dari poin yang sudah dipotong remisi manual itu,
 * jadi saat remisi manual dihapus baris ini perlu dihitung ulang.
 */
export function autoRemisiIdsToRebuild(
  adjustments: RemisiAdjustmentInput[],
  manualEffectiveYmd: string
): string[] {
  const reversedIds = new Set(
    adjustments.map((a) => a.reversalOfId).filter((id): id is string => Boolean(id))
  );
  return adjustments
    .filter((a) => {
      if (a.reversalOfId || reversedIds.has(a.id)) return false;
      if (!isQuietMonthReason(a.reason)) return false;
      return a.effectiveYmd > manualEffectiveYmd;
    })
    .map((a) => a.id);
}

export function computeRemisiPlan(input: {
  incidents: RemisiIncident[];
  adjustments: RemisiAdjustmentInput[];
  todayYmd: string;
}): { toCreate: RemisiToCreate[]; toReverse: RemisiToReverse[]; next: RemisiNext | null } {
  const todayYmd = input.todayYmd.trim();
  const dates = uniqueDates(input.incidents);
  const reversedIds = new Set(
    input.adjustments.map((a) => a.reversalOfId).filter((id): id is string => Boolean(id))
  );

  const active = input.adjustments.filter((a) => !a.reversalOfId && !reversedIds.has(a.id) && !isQuietMonthReversalReason(a.reason));

  const claims = new Map<string, Claim[]>();
  const simEff = new Map<string, string>();
  for (const adj of active) {
    if (!isQuietMonthReason(adj.reason)) continue;
    const parsed = parseQuietMonthReason(adj.reason);
    const legacy = parsed.step == null;
    const anchorYmd = parsed.anchor ?? (legacy ? lastIncidentOnOrBefore(dates, adj.createdYmd) : null);
    const step = parsed.step ?? (anchorYmd ? 1 : null);
    if (!anchorYmd || step == null) continue;
    if (legacy) {
      const due1 = addMonthsClampYmd(anchorYmd, 1);
      if (due1 < adj.effectiveYmd) simEff.set(adj.id, due1);
    }
    const key = `${anchorYmd}|${step}`;
    const list = claims.get(key) ?? [];
    list.push({
      id: adj.id,
      anchorYmd,
      step,
      legacy,
      effectiveYmd: adj.effectiveYmd,
      pointsDelta: adj.pointsDelta,
    });
    claims.set(key, list);
  }

  const expected = expectedStages(dates, todayYmd);
  const expectedKeys = new Set(expected.map((e) => `${e.anchorYmd}|${e.step}`));
  const dueByKey = new Map(expected.map((e) => [`${e.anchorYmd}|${e.step}`, e.dueYmd]));

  const toReverse: RemisiToReverse[] = [];
  const reverseIds = new Set<string>();

  function pushReverse(claim: Claim) {
    if (reverseIds.has(claim.id)) return;
    const dueYmd = dueByKey.get(`${claim.anchorYmd}|${claim.step}`) ?? addMonthsClampYmd(claim.anchorYmd, claim.step);
    reverseIds.add(claim.id);
    toReverse.push({
      adjustmentId: claim.id,
      anchorYmd: claim.anchorYmd,
      step: claim.step,
      pointsDelta: Math.abs(claim.pointsDelta),
      sebab: sebabFor(claim.anchorYmd, dueYmd, dates),
    });
  }

  for (const [key, list] of claims) {
    const ordered = [...list].sort((a, b) => a.effectiveYmd.localeCompare(b.effectiveYmd) || a.id.localeCompare(b.id));
    const legacy = ordered.filter((c) => c.legacy);
    const stepped = ordered.filter((c) => !c.legacy);
    if (expectedKeys.has(key)) {
      const extras = legacy.length > 0 ? stepped : stepped.slice(1);
      for (const extra of extras) pushReverse(extra);
    } else {
      for (const row of stepped) pushReverse(row);
    }
  }

  const claimedKeys = new Set<string>();
  for (const [key, list] of claims) {
    if (list.some((c) => !reverseIds.has(c.id))) claimedKeys.add(key);
  }

  const missing = expected
    .filter((e) => !claimedKeys.has(`${e.anchorYmd}|${e.step}`))
    .sort((a, b) => a.dueYmd.localeCompare(b.dueYmd) || a.anchorYmd.localeCompare(b.anchorYmd) || a.step - b.step);

  const toCreate: RemisiToCreate[] = [];
  const stopped = new Set<string>();

  function effBefore(dueYmd: string): number {
    let sum = 0;
    for (const inc of input.incidents) {
      if (YMD.test(inc.ymd) && inc.ymd < dueYmd) sum += inc.points;
    }
    for (const adj of active) {
      if (reverseIds.has(adj.id)) continue;
      if ((simEff.get(adj.id) ?? adj.effectiveYmd) < dueYmd) sum += adj.pointsDelta;
    }
    for (const created of toCreate) {
      if (created.dueYmd < dueYmd) sum += created.pointsDelta;
    }
    return sum;
  }

  for (const stage of missing) {
    if (stopped.has(stage.anchorYmd)) continue;
    const effectiveBefore = effBefore(stage.dueYmd);
    const pointsDelta = stageCut(effectiveBefore);
    if (pointsDelta == null) {
      stopped.add(stage.anchorYmd);
      continue;
    }
    toCreate.push({
      anchorYmd: stage.anchorYmd,
      step: stage.step,
      dueYmd: stage.dueYmd,
      effectiveBefore,
      pointsDelta,
      isBackfill: stage.dueYmd < todayYmd,
    });
  }

  const next = computeNext(dates, todayYmd, input.incidents, active, reverseIds, toCreate, simEff);
  return { toCreate, toReverse, next };
}

function computeNext(
  dates: string[],
  todayYmd: string,
  incidents: RemisiIncident[],
  active: RemisiAdjustmentInput[],
  reverseIds: Set<string>,
  toCreate: RemisiToCreate[],
  simEff: Map<string, string>
): RemisiNext | null {
  if (dates.length === 0) return null;
  let effectiveNow = 0;
  for (const inc of incidents) {
    if (YMD.test(inc.ymd)) effectiveNow += inc.points;
  }
  for (const adj of active) {
    if (reverseIds.has(adj.id)) continue;
    if ((simEff.get(adj.id) ?? adj.effectiveYmd) <= todayYmd) effectiveNow += adj.pointsDelta;
  }
  for (const created of toCreate) effectiveNow += created.pointsDelta;
  if (effectiveNow <= 0) return null;

  const anchorYmd = dates[dates.length - 1]!;
  for (let n = 1; n <= 120; n++) {
    const dueYmd = addMonthsClampYmd(anchorYmd, n);
    if (dueYmd <= anchorYmd) return null;
    if (dueYmd > todayYmd) {
      const estimatedDelta = stageCut(effectiveNow);
      if (estimatedDelta == null) return null;
      return { anchorYmd, step: n, dueYmd, estimatedDelta, effectiveNow };
    }
  }
  return null;
}
