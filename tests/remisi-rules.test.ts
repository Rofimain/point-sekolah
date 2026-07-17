import test from "node:test";
import assert from "node:assert/strict";
import {
  MANUAL_REMISI_TYPE,
  resolveManualRemisiPercent,
  buildManualRemisiReason,
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

test("formatPointAdjustmentReason labels", () => {
  assert.match(formatPointAdjustmentReason(QUIET_MONTH_REASON), /otomatis/i);
  assert.match(
    formatPointAdjustmentReason(buildManualRemisiReason(MANUAL_REMISI_TYPE.KHOTIB_JUMAT, "Jumat 17 Jul")),
    /khotib/i
  );
});
