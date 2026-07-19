import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail } from "../lib/normalize-email";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Ashram.Vedanta@Gmail.com "), "ashram.vedanta@gmail.com");
});
