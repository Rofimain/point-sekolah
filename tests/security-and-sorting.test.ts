import test from "node:test";
import assert from "node:assert/strict";
import { parseEvidenceImageDataUrl } from "../lib/evidence-data-url";
import { validateNewPassword } from "../lib/password-policy";
import { clearPasswordAttempts, passwordAttemptStatus, recordFailedPasswordAttempt } from "../lib/account-rate-limit";
import { sortDashboardRows, type DashStudentRow } from "../components/dashboard/DashboardRankedTables";
import { canReadViolationRecord } from "../lib/record-access";
import { createViolationEvidencePdf } from "../lib/violation-evidence-pdf";
import {
  AUTH_GENERIC_CREDENTIALS_ERROR,
  AUTH_LOCK_DURATION_MS,
  AUTH_MAX_FAILED_LOGINS,
  AUTH_SESSION_REPLACED_ERROR,
  shouldEnforceSingleSession,
} from "../lib/auth-constants";
import { computeLockUntil, isAccountLocked } from "../lib/auth-lockout";
import { activeFlagFromStatus, canUserLogin, statusFromActiveToggle } from "../lib/user-status";
import { buildUserLookupMaps, matchImportUser } from "../lib/user-import-match";
import {
  GOOGLE_NOT_REGISTERED_MESSAGE,
  inferGooglePortal,
  isGoogleEmailDomainAllowed,
  mapGoogleErrorCode,
} from "../lib/google-auth-messages";

test("password policy enforces length and bcrypt byte boundary", () => {
  assert.equal(validateNewPassword("terlalupendek").ok, true);
  assert.equal(validateNewPassword("pendek").ok, false);
  assert.equal(validateNewPassword("😀".repeat(19)).ok, false);
  assert.equal(validateNewPassword("aman-sekali-123").ok, true);
});

test("evidence parser accepts real PNG and rejects MIME spoofing", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const parsed = parseEvidenceImageDataUrl(png);
  assert.equal(parsed.mime, "image/png");
  assert.throws(() => parseEvidenceImageDataUrl(png.replace("image/png", "image/jpeg")));
  assert.throws(() => parseEvidenceImageDataUrl("data:image/svg+xml;base64,PHN2Zz4="));
  assert.throws(() =>
    parseEvidenceImageDataUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
  );
});

test("evidence parser accepts WebP magic bytes and rejects spoofed WebP", () => {
  // Minimal RIFF/WEBP header + padding (not a real decodeable image, but magic matches)
  const webpBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x0a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00, 0x00]);
  const webp = `data:image/webp;base64,${webpBytes.toString("base64")}`;
  const parsed = parseEvidenceImageDataUrl(webp);
  assert.equal(parsed.mime, "image/webp");
  assert.throws(() =>
    parseEvidenceImageDataUrl(`data:image/webp;base64,${Buffer.from("not-webp-magic!!").toString("base64")}`)
  );
});

test("password limiter blocks the sixth failed attempt", () => {
  const id = `test-${Date.now()}`;
  clearPasswordAttempts(id);
  for (let attempt = 0; attempt < 5; attempt += 1) recordFailedPasswordAttempt(id, 1_000);
  assert.equal(passwordAttemptStatus(id, 1_001).allowed, false);
  clearPasswordAttempts(id);
});

test("login lockout engages at max failed count", () => {
  const now = new Date("2026-07-19T00:00:00.000Z");
  assert.equal(computeLockUntil(AUTH_MAX_FAILED_LOGINS - 1, now), null);
  const lockedUntil = computeLockUntil(AUTH_MAX_FAILED_LOGINS, now);
  assert.ok(lockedUntil);
  assert.equal(lockedUntil.getTime(), now.getTime() + AUTH_LOCK_DURATION_MS);
  assert.equal(isAccountLocked(lockedUntil, now), true);
  assert.equal(isAccountLocked(lockedUntil, new Date(lockedUntil.getTime() + 1)), false);
});

test("auth generic credentials error avoids account enumeration wording", () => {
  assert.match(AUTH_GENERIC_CREDENTIALS_ERROR, /password/i);
  assert.doesNotMatch(AUTH_GENERIC_CREDENTIALS_ERROR, /tidak ditemukan/i);
});

test("user status login gate and active toggle mapping", () => {
  assert.equal(canUserLogin("ACTIVE"), true);
  assert.equal(canUserLogin("SUSPENDED"), false);
  assert.equal(canUserLogin("GRADUATED"), false);
  assert.equal(canUserLogin("LEFT"), false);
  assert.equal(statusFromActiveToggle(true), "ACTIVE");
  assert.equal(statusFromActiveToggle(false), "SUSPENDED");
  assert.equal(activeFlagFromStatus("ACTIVE"), true);
  assert.equal(activeFlagFromStatus("LEFT"), false);
});

test("google error messages map AccessDenied to unregistered copy", () => {
  assert.equal(mapGoogleErrorCode("NOT_REGISTERED"), GOOGLE_NOT_REGISTERED_MESSAGE);
  assert.equal(mapGoogleErrorCode("AccessDenied"), GOOGLE_NOT_REGISTERED_MESSAGE);
  assert.equal(mapGoogleErrorCode("CONFLICT"), "Akun Google tidak cocok dengan data pengguna. Hubungi Administrator.");
  assert.equal(mapGoogleErrorCode("SESSION_REPLACED"), AUTH_SESSION_REPLACED_ERROR);
});

test("single session only enforced for STUDENT role", () => {
  assert.equal(shouldEnforceSingleSession("STUDENT"), true);
  assert.equal(shouldEnforceSingleSession("TEACHER"), false);
  assert.equal(shouldEnforceSingleSession("ADMIN"), false);
  assert.equal(shouldEnforceSingleSession("SUPER_ADMIN"), false);
  assert.equal(shouldEnforceSingleSession(null), false);
});

test("infer google portal from callback url", () => {
  assert.equal(inferGooglePortal("/?portal=staff"), "staff");
  assert.equal(inferGooglePortal("/dashboard"), "staff");
  assert.equal(inferGooglePortal("/"), "student");
});

test("google email domain allowlist", () => {
  const prevStudent = process.env.NEXT_PUBLIC_STUDENT_DOMAIN;
  const prevStaff = process.env.NEXT_PUBLIC_STAFF_DOMAIN;
  const prevOverride = process.env.AUTH_GOOGLE_ALLOWED_EMAIL_DOMAINS;
  process.env.NEXT_PUBLIC_STUDENT_DOMAIN = "smaalazhar1.sch.id";
  process.env.NEXT_PUBLIC_STAFF_DOMAIN = "smaalazhar1.sch.id";
  delete process.env.AUTH_GOOGLE_ALLOWED_EMAIL_DOMAINS;
  assert.equal(isGoogleEmailDomainAllowed("guru@smaalazhar1.sch.id"), true);
  assert.equal(isGoogleEmailDomainAllowed("siswa@smaalazhar1.sch.id"), true);
  assert.equal(isGoogleEmailDomainAllowed("orang@gmail.com"), false);
  if (prevStudent === undefined) delete process.env.NEXT_PUBLIC_STUDENT_DOMAIN;
  else process.env.NEXT_PUBLIC_STUDENT_DOMAIN = prevStudent;
  if (prevStaff === undefined) delete process.env.NEXT_PUBLIC_STAFF_DOMAIN;
  else process.env.NEXT_PUBLIC_STAFF_DOMAIN = prevStaff;
  if (prevOverride === undefined) delete process.env.AUTH_GOOGLE_ALLOWED_EMAIL_DOMAINS;
  else process.env.AUTH_GOOGLE_ALLOWED_EMAIL_DOMAINS = prevOverride;
});

test("import match prioritizes id then nisn then email and detects conflicts", () => {
  const users = [
    { id: "u1", nisn: "111", nip: null, email: "a@x.id", status: "ACTIVE" },
    { id: "u2", nisn: "222", nip: null, email: "b@x.id", status: "LEFT" },
  ];
  const maps = buildUserLookupMaps(users);
  assert.equal(
    matchImportUser({ id: "u1", email: "b@x.id" }, maps.byId, maps.byNisn, maps.byNip, maps.byEmail).kind,
    "conflict"
  );
  const byNisn = matchImportUser({ nisn: "111" }, maps.byId, maps.byNisn, maps.byNip, maps.byEmail);
  assert.equal(byNisn.kind, "match");
  if (byNisn.kind === "match") assert.equal(byNisn.via, "nisn");
  assert.equal(matchImportUser({ email: "new@x.id" }, maps.byId, maps.byNisn, maps.byNip, maps.byEmail).kind, "create");
});

test("dashboard sorting uses deterministic name and id tie-breakers", () => {
  const rows: DashStudentRow[] = [
    { id: "b", name: "Budi", className: "XI", total: 50 },
    { id: "c", name: "Ani", className: "X", total: 50 },
    { id: "a", name: "Ani", className: "X", total: 50 },
  ];
  const sorted = sortDashboardRows(rows, { key: "points", direction: "desc" }, 75);
  assert.deepEqual(
    sorted.map((row) => row.id),
    ["a", "c", "b"]
  );
});

test("students can only read their own record while staff can read records", () => {
  assert.equal(canReadViolationRecord({ id: "student-a", role: "STUDENT" }, "student-a"), true);
  assert.equal(canReadViolationRecord({ id: "student-a", role: "STUDENT" }, "student-b"), false);
  assert.equal(canReadViolationRecord({ id: "teacher", role: "TEACHER" }, "student-b"), true);
});

test("evidence report generator returns a valid PDF document", async () => {
  const pdf = await createViolationEvidencePdf({
    id: "record-smoke-test",
    student: { name: "Siswa Uji", nisn: "1234567890", class: { name: "X IPA 1" } },
    violationType: { name: "Pelanggaran Uji" },
    points: 10,
    session: "Jam 1-2",
    notes: "Catatan pengujian",
    date: new Date("2026-07-15T00:00:00.000Z"),
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    createdByName: "Guru Uji",
    evidenceImageData: null,
    studentSignatureData: "Saya mengakui pelanggaran ini.",
  });
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
});
