import test from "node:test";
import assert from "node:assert/strict";
import { parseEvidenceImageDataUrl } from "../lib/evidence-data-url";
import { validateNewPassword } from "../lib/password-policy";
import { clearPasswordAttempts, passwordAttemptStatus, recordFailedPasswordAttempt } from "../lib/account-rate-limit";
import { sortDashboardRows, type DashStudentRow } from "../components/dashboard/DashboardRankedTables";
import { canReadViolationRecord } from "../lib/record-access";

test("password policy enforces length and bcrypt byte boundary", () => {
  assert.equal(validateNewPassword("terlalupendek").ok, true);
  assert.equal(validateNewPassword("pendek").ok, false);
  assert.equal(validateNewPassword("😀".repeat(19)).ok, false);
  assert.equal(validateNewPassword("aman-sekali-123").ok, true);
});

test("evidence parser accepts real PNG and rejects MIME spoofing", () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const parsed = parseEvidenceImageDataUrl(png);
  assert.equal(parsed.mime, "image/png");
  assert.throws(() => parseEvidenceImageDataUrl(png.replace("image/png", "image/jpeg")));
  assert.throws(() => parseEvidenceImageDataUrl("data:image/svg+xml;base64,PHN2Zz4="));
});

test("password limiter blocks the sixth failed attempt", () => {
  const id = `test-${Date.now()}`;
  clearPasswordAttempts(id);
  for (let attempt = 0; attempt < 5; attempt += 1) recordFailedPasswordAttempt(id, 1_000);
  assert.equal(passwordAttemptStatus(id, 1_001).allowed, false);
  clearPasswordAttempts(id);
});

test("dashboard sorting uses deterministic name and id tie-breakers", () => {
  const rows: DashStudentRow[] = [
    { id: "b", name: "Budi", className: "XI", total: 50 },
    { id: "c", name: "Ani", className: "X", total: 50 },
    { id: "a", name: "Ani", className: "X", total: 50 },
  ];
  const sorted = sortDashboardRows(rows, { key: "points", direction: "desc" }, 75);
  assert.deepEqual(sorted.map((row) => row.id), ["a", "c", "b"]);
});

test("students can only read their own record while staff can read records", () => {
  assert.equal(canReadViolationRecord({ id: "student-a", role: "STUDENT" }, "student-a"), true);
  assert.equal(canReadViolationRecord({ id: "student-a", role: "STUDENT" }, "student-b"), false);
  assert.equal(canReadViolationRecord({ id: "teacher", role: "TEACHER" }, "student-b"), true);
});
