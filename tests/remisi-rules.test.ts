import test from "node:test";
import assert from "node:assert/strict";
import {
  MANUAL_REMISI_TYPE,
  resolveManualRemisiPercent,
  buildManualRemisiReason,
  parseManualRemisiReason,
} from "../lib/remisi-rules";
import { formatPointAdjustmentReason, QUIET_MONTH_REASON } from "../lib/point-adjustment-reason";

test("resolveManualRemisiPercent fixed juara sekolah", () => {
  const r = resolveManualRemisiPercent(MANUAL_REMISI_TYPE.JUARA_SEKOLAH);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.percent, 15);
});

test("resolveManualRemisiPercent hafalan multiplier", () => {
  const r = resolveManualRemisiPercent(MANUAL_REMISI_TYPE.HAFALAN, { multiplier: 3 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.percent, 30);
});

test("resolveManualRemisiPercent prestasi custom", () => {
  const bad = resolveManualRemisiPercent(MANUAL_REMISI_TYPE.PRESTASI_REKOMENDASI);
  assert.equal(bad.ok, false);
  const ok = resolveManualRemisiPercent(MANUAL_REMISI_TYPE.PRESTASI_REKOMENDASI, { customPercent: 20 });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.percent, 20);
});

test("resolveManualRemisiPercent CUSTOM requires percent", () => {
  const bad = resolveManualRemisiPercent(MANUAL_REMISI_TYPE.CUSTOM);
  assert.equal(bad.ok, false);
  const ok = resolveManualRemisiPercent(MANUAL_REMISI_TYPE.CUSTOM, { customPercent: 12 });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.percent, 12);
});

test("build/parse manual remisi reason with asOf and custom label", () => {
  const reason = buildManualRemisiReason(MANUAL_REMISI_TYPE.CUSTOM, {
    customLabel: "Juara robotik",
    achievementYmd: "2026-07-10",
    note: "Juara 1",
  });
  const p = parseManualRemisiReason(reason);
  assert.equal(p.code, "MANUAL_CUSTOM");
  assert.equal(p.customLabel, "Juara robotik");
  assert.equal(p.achievementYmd, "2026-07-10");
  assert.equal(p.note, "Juara 1");
  assert.match(formatPointAdjustmentReason(reason), /Juara robotik/);
  assert.match(formatPointAdjustmentReason(reason), /2026-07-10/);
});

test("formatPointAdjustmentReason labels", () => {
  assert.match(formatPointAdjustmentReason(QUIET_MONTH_REASON), /otomatis/i);
  assert.match(formatPointAdjustmentReason("QUIET_MONTH_REDUCTION|anchor=2026-05-01"), /2026-05-01/);
  assert.match(
    formatPointAdjustmentReason(
      buildManualRemisiReason(MANUAL_REMISI_TYPE.KHOTIB_JUMAT, {
        achievementYmd: "2026-07-17",
        note: "Jumat 17 Jul",
      })
    ),
    /khotib/i
  );
});
