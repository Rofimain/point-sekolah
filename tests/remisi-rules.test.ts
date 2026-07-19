import test from "node:test";
import assert from "node:assert/strict";
import {
  MANUAL_REMISI_REASON_CODE,
  resolveManualRemisiPercent,
  buildManualRemisiReason,
  parseManualRemisiReason,
} from "../lib/remisi-rules";
import { formatPointAdjustmentReason, QUIET_MONTH_REASON } from "../lib/point-adjustment-reason";

test("resolveManualRemisiPercent validates 1–100", () => {
  assert.equal(resolveManualRemisiPercent(undefined).ok, false);
  assert.equal(resolveManualRemisiPercent(0).ok, false);
  assert.equal(resolveManualRemisiPercent(101).ok, false);
  const ok = resolveManualRemisiPercent(12);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.percent, 12);
});

test("build/parse manual remisi reason with asOf and custom label", () => {
  const reason = buildManualRemisiReason({
    customLabel: "Juara robotik",
    achievementYmd: "2026-07-10",
    note: "Juara 1",
  });
  const p = parseManualRemisiReason(reason);
  assert.equal(p.code, MANUAL_REMISI_REASON_CODE);
  assert.equal(p.customLabel, "Juara robotik");
  assert.equal(p.achievementYmd, "2026-07-10");
  assert.equal(p.note, "Juara 1");
  assert.match(formatPointAdjustmentReason(reason), /Juara robotik/);
  assert.match(formatPointAdjustmentReason(reason), /2026-07-10/);
});

test("formatPointAdjustmentReason labels", () => {
  assert.match(formatPointAdjustmentReason(QUIET_MONTH_REASON), /otomatis/i);
  assert.match(formatPointAdjustmentReason("QUIET_MONTH_REDUCTION|anchor=2026-05-01"), /2026-05-01/);
  // Riwayat lama (preset) tetap terbaca
  assert.match(formatPointAdjustmentReason("MANUAL_KHOTIB_JUMAT|asOf:2026-07-17|Jumat 17 Jul"), /khotib/i);
});
