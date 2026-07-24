import test from "node:test";
import assert from "node:assert/strict";
import {
  compareStudentsListRows,
  nextStudentsListSort,
  parseStudentsListSort,
  sortStudentsListRows,
} from "../lib/students-list-sort";

test("parseStudentsListSort defaults to name asc", () => {
  assert.deepEqual(parseStudentsListSort(undefined, undefined), { key: "name", direction: "asc" });
  assert.deepEqual(parseStudentsListSort("bogus", "nope"), { key: "name", direction: "asc" });
});

test("parseStudentsListSort accepts name/points and dirs", () => {
  assert.deepEqual(parseStudentsListSort("name", "desc"), { key: "name", direction: "desc" });
  assert.deepEqual(parseStudentsListSort("points", "asc"), { key: "points", direction: "asc" });
  assert.deepEqual(parseStudentsListSort("points", null), { key: "points", direction: "desc" });
});

test("nextStudentsListSort toggles same column and defaults new column", () => {
  assert.deepEqual(nextStudentsListSort({ key: "name", direction: "asc" }, "name"), {
    key: "name",
    direction: "desc",
  });
  assert.deepEqual(nextStudentsListSort({ key: "name", direction: "asc" }, "points"), {
    key: "points",
    direction: "desc",
  });
});

test("sortStudentsListRows by points then name tie-break", () => {
  const rows = [
    { id: "2", name: "Budi", points: 10 },
    { id: "1", name: "Ani", points: 10 },
    { id: "3", name: "Citra", points: 5 },
  ];
  const byPointsDesc = sortStudentsListRows(rows, { key: "points", direction: "desc" });
  assert.deepEqual(
    byPointsDesc.map((r) => r.id),
    ["1", "2", "3"]
  );
  const byNameAsc = sortStudentsListRows(rows, { key: "name", direction: "asc" });
  assert.deepEqual(
    byNameAsc.map((r) => r.name),
    ["Ani", "Budi", "Citra"]
  );
  assert.ok(compareStudentsListRows(rows[0], rows[2], { key: "points", direction: "asc" }) > 0);
});
