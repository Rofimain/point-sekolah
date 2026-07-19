import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuietMonthReason,
  formatPointAdjustmentReason,
  isQuietMonthReason,
  parseQuietMonthAnchor,
  QUIET_MONTH_REASON,
} from "../lib/point-adjustment-reason";
import { findUnclaimedQuietGaps, isLastWindowClaimed } from "../lib/quiet-month-gaps";

test("build/parse quiet month reason with anchor", () => {
  const r = buildQuietMonthReason("2026-05-01");
  assert.equal(r, "QUIET_MONTH_REDUCTION|anchor=2026-05-01");
  assert.equal(isQuietMonthReason(r), true);
  assert.equal(parseQuietMonthAnchor(r), "2026-05-01");
  assert.equal(parseQuietMonthAnchor(QUIET_MONTH_REASON), null);
  assert.match(formatPointAdjustmentReason(r), /periode tenang/i);
  assert.match(formatPointAdjustmentReason(r), /2026-05-01/);
});

test("findUnclaimedQuietGaps: May→July eligible with 0-point breaker", () => {
  const gaps = findUnclaimedQuietGaps({
    incidentYmds: ["2026-05-01", "2026-07-19"],
    claimedAnchors: new Set(),
    quietDays: 30,
  });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.anchorYmd, "2026-05-01");
  assert.equal(gaps[0]!.nextYmd, "2026-07-19");
  assert.ok(gaps[0]!.daysQuiet >= 30);
});

test("findUnclaimedQuietGaps: idempotent when anchor claimed", () => {
  const gaps = findUnclaimedQuietGaps({
    incidentYmds: ["2026-05-01", "2026-07-19"],
    claimedAnchors: new Set(["2026-05-01"]),
    quietDays: 30,
  });
  assert.equal(gaps.length, 0);
});

test("findUnclaimedQuietGaps: short gap not eligible", () => {
  const gaps = findUnclaimedQuietGaps({
    incidentYmds: ["2026-07-01", "2026-07-19"],
    claimedAnchors: new Set(),
    quietDays: 30,
  });
  assert.equal(gaps.length, 0);
});

test("findUnclaimedQuietGaps: multiple gaps oldest first order", () => {
  const gaps = findUnclaimedQuietGaps({
    incidentYmds: ["2026-01-01", "2026-03-01", "2026-05-15"],
    claimedAnchors: new Set(),
    quietDays: 30,
  });
  assert.equal(gaps.length, 2);
  assert.equal(gaps[0]!.anchorYmd, "2026-01-01");
  assert.equal(gaps[1]!.anchorYmd, "2026-03-01");
});

test("isLastWindowClaimed: anchored claim blocks last→now", () => {
  assert.equal(
    isLastWindowClaimed({
      lastVioYmd: "2026-07-19",
      claimedAnchors: new Set(["2026-07-19"]),
      legacyQuietAdjustments: [],
    }),
    true
  );
  assert.equal(
    isLastWindowClaimed({
      lastVioYmd: "2026-07-19",
      claimedAnchors: new Set(["2026-05-01"]),
      legacyQuietAdjustments: [],
    }),
    false
  );
});

test("isLastWindowClaimed: legacy unanchored still blocks by createdAt", () => {
  assert.equal(
    isLastWindowClaimed({
      lastVioYmd: "2026-05-01",
      claimedAnchors: new Set(),
      legacyQuietAdjustments: [{ createdAt: new Date("2026-06-15T12:00:00+07:00") }],
    }),
    true
  );
  assert.equal(
    isLastWindowClaimed({
      lastVioYmd: "2026-07-19",
      claimedAnchors: new Set(),
      legacyQuietAdjustments: [{ createdAt: new Date("2026-06-15T12:00:00+07:00") }],
    }),
    false
  );
});
