import test from "node:test";
import assert from "node:assert/strict";
import {
  MANUAL_REMISI_REASON_CODE,
  resolveManualRemisiPercent,
  buildManualRemisiReason,
  parseManualRemisiReason,
  isDeletableManualRemisi,
  effectivePointsAfterRemovingDelta,
  manualRemisiCutFromCurrentPoints,
  balanceBeforeManualRemisi,
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

test("remisi manual mengambil persen dari poin saat ini", () => {
  assert.equal(manualRemisiCutFromCurrentPoints(40, 10), 4);
  assert.equal(manualRemisiCutFromCurrentPoints(36, 10), 4);
  assert.equal(manualRemisiCutFromCurrentPoints(40, 25), 10);
  assert.equal(manualRemisiCutFromCurrentPoints(30, 25), 8);
  assert.equal(manualRemisiCutFromCurrentPoints(8, 25), 2);
  assert.equal(manualRemisiCutFromCurrentPoints(0, 10), 0);
});

test("basis edit remisi mengabaikan pelanggaran dan remisi otomatis sesudahnya", () => {
  const pagi = Date.parse("2026-10-01T02:00:00.000Z");
  const siang = Date.parse("2026-10-01T03:00:00.000Z");
  const basis = balanceBeforeManualRemisi({
    violations: [
      { ymd: "2026-09-02", points: 40 },
      { ymd: "2026-10-03", points: 5 },
      { ymd: "2026-10-04", points: 5 },
    ],
    adjustments: [
      { id: "m1", atMs: pagi, pointsDelta: -10 },
      { id: "m2", atMs: siang, pointsDelta: -8 },
      { id: "auto", atMs: Date.parse("2026-10-02T12:00:00.000Z"), pointsDelta: -6 },
    ],
    remisiId: "m2",
    remisiAtMs: siang,
    remisiYmd: "2026-10-01",
  });
  assert.equal(basis, 30);
  assert.equal(manualRemisiCutFromCurrentPoints(basis, 10), 3);
});

test("hanya reason MANUAL_ yang boleh dihapus", () => {
  const manual = buildManualRemisiReason({ customLabel: "Juara Basket FEBUI", achievementYmd: "2026-09-18" });
  assert.equal(isDeletableManualRemisi(manual, null), true);
  assert.equal(isDeletableManualRemisi("MANUAL_KHOTIB_JUMAT|asOf:2026-07-17", null), true);
  assert.equal(isDeletableManualRemisi("QUIET_MONTH_REDUCTION|anchor=2026-09-18|step=1", null), false);
  assert.equal(isDeletableManualRemisi("QUIET_MONTH_REVERSAL|anchor=2026-09-18|step=1|sebab=x", null), false);
  assert.equal(isDeletableManualRemisi(manual, "adj_lain"), false);
});

test("hapus satu remisi manual mengembalikan potongannya, remisi otomatis tetap dijumlah", () => {
  const duplicate = effectivePointsAfterRemovingDelta(40, -10, -5);
  assert.deepEqual(duplicate, { before: 30, after: 35, restored: 5 });

  const withAuto = effectivePointsAfterRemovingDelta(40, -18, -5);
  assert.deepEqual(withAuto, { before: 22, after: 27, restored: 5 });

  const floored = effectivePointsAfterRemovingDelta(4, -8, -8);
  assert.deepEqual(floored, { before: 0, after: 4, restored: 4 });
});

test("formatPointAdjustmentReason labels", () => {
  assert.match(formatPointAdjustmentReason(QUIET_MONTH_REASON), /otomatis/i);
  assert.match(formatPointAdjustmentReason("QUIET_MONTH_REDUCTION|anchor=2026-05-01"), /2026-05-01/);
  // Riwayat lama (preset) tetap terbaca
  assert.match(formatPointAdjustmentReason("MANUAL_KHOTIB_JUMAT|asOf:2026-07-17|Jumat 17 Jul"), /khotib/i);
});
