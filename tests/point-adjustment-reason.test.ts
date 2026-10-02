import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuietMonthReason,
  formatPointAdjustmentReason,
  isQuietMonthReason,
  parseQuietMonthAnchor,
  QUIET_MONTH_REASON,
} from "../lib/point-adjustment-reason";

test("build/parse quiet month reason with anchor", () => {
  const r = buildQuietMonthReason("2026-05-01");
  assert.equal(r, "QUIET_MONTH_REDUCTION|anchor=2026-05-01");
  assert.equal(isQuietMonthReason(r), true);
  assert.equal(parseQuietMonthAnchor(r), "2026-05-01");
  assert.equal(parseQuietMonthAnchor(QUIET_MONTH_REASON), null);
  assert.match(formatPointAdjustmentReason(r), /periode tenang/i);
  assert.match(formatPointAdjustmentReason(r), /2026-05-01/);
});
