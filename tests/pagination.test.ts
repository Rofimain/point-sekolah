import assert from "node:assert/strict";
import test from "node:test";
import { visiblePageNumbers } from "../lib/pagination";

test("visiblePageNumbers lists all pages when total fits", () => {
  assert.deepEqual(visiblePageNumbers(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(visiblePageNumbers(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test("visiblePageNumbers slides window so high pages are reachable", () => {
  assert.deepEqual(visiblePageNumbers(7, 14), [4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(visiblePageNumbers(14, 14), [8, 9, 10, 11, 12, 13, 14]);
  assert.deepEqual(visiblePageNumbers(1, 14), [1, 2, 3, 4, 5, 6, 7]);
});

test("visiblePageNumbers clamps current into range", () => {
  assert.deepEqual(visiblePageNumbers(0, 3), [1, 2, 3]);
  assert.deepEqual(visiblePageNumbers(99, 3), [1, 2, 3]);
});
