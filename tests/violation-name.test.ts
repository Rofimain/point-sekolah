import test from "node:test";
import assert from "node:assert/strict";
import { violationCodeSortOrder, violationNameSortOrder } from "../lib/violation-name";

test("violationCodeSortOrder sorts by nomor then suffix", () => {
  assert.ok(violationCodeSortOrder("47") < violationCodeSortOrder("48"));
  assert.ok(violationCodeSortOrder("48") < violationCodeSortOrder("91"));
  assert.ok(violationCodeSortOrder("12") < violationCodeSortOrder("12A"));
  assert.ok(violationCodeSortOrder("12A") < violationCodeSortOrder("12B"));
  assert.ok(violationCodeSortOrder("12B") < violationCodeSortOrder("13"));
});

test("violationNameSortOrder reads bracket code", () => {
  assert.equal(violationNameSortOrder("[91] tes"), violationCodeSortOrder("91"));
  assert.ok(
    violationNameSortOrder("[48] Duduk di wastafel") < violationNameSortOrder("[91] tes")
  );
});
