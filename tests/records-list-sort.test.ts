import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RECORDS_LIST_SORT,
  nextRecordsListSort,
  parseRecordsListSort,
  recordsSortLabel,
  sortRecordsListRows,
  sortRecordsRosterStudents,
} from "../lib/records-list-sort";

test("parseRecordsListSort defaults to date desc", () => {
  assert.deepEqual(parseRecordsListSort(undefined, undefined), DEFAULT_RECORDS_LIST_SORT);
  assert.deepEqual(parseRecordsListSort("bogus", null), DEFAULT_RECORDS_LIST_SORT);
});

test("parseRecordsListSort accepts keys and dirs", () => {
  assert.deepEqual(parseRecordsListSort("name", "desc"), { key: "name", direction: "desc" });
  assert.deepEqual(parseRecordsListSort("violation", "asc"), { key: "violation", direction: "asc" });
  assert.deepEqual(parseRecordsListSort("points", null), { key: "points", direction: "desc" });
});

test("nextRecordsListSort toggles and picks defaults", () => {
  assert.deepEqual(nextRecordsListSort({ key: "date", direction: "desc" }, "date"), {
    key: "date",
    direction: "asc",
  });
  assert.deepEqual(nextRecordsListSort({ key: "date", direction: "desc" }, "name"), {
    key: "name",
    direction: "asc",
  });
});

test("sortRecordsListRows by name and points", () => {
  const rows = [
    {
      id: "2",
      studentId: "s2",
      studentName: "Budi",
      violationName: "Terlambat",
      date: new Date("2026-07-20"),
      totalPoints: 10,
    },
    {
      id: "1",
      studentId: "s1",
      studentName: "Ani",
      violationName: "Seragam",
      date: new Date("2026-07-21"),
      totalPoints: 5,
    },
  ];
  assert.deepEqual(
    sortRecordsListRows(rows, { key: "name", direction: "asc" }).map((r) => r.id),
    ["1", "2"]
  );
  assert.deepEqual(
    sortRecordsListRows(rows, { key: "points", direction: "desc" }).map((r) => r.id),
    ["2", "1"]
  );
  assert.deepEqual(
    sortRecordsListRows(rows, { key: "date", direction: "desc" }).map((r) => r.id),
    ["1", "2"]
  );
});

test("sortRecordsRosterStudents by latest date", () => {
  const rows = [
    { id: "a", name: "A", totalPoints: 0, latestDate: new Date("2026-07-01"), latestViolationName: "X" },
    { id: "b", name: "B", totalPoints: 5, latestDate: new Date("2026-07-20"), latestViolationName: "Y" },
  ];
  assert.deepEqual(
    sortRecordsRosterStudents(rows, { key: "date", direction: "desc" }).map((r) => r.id),
    ["b", "a"]
  );
});

test("recordsSortLabel is human readable", () => {
  assert.match(recordsSortLabel(DEFAULT_RECORDS_LIST_SORT), /tanggal/i);
});
