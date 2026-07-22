import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserFieldChanges,
  classifyLoginIdentifier,
  formatChangesSummary,
  loginMethodLabel,
} from "../lib/access-log-diff";

test("classifyLoginIdentifier: email / nisn / nip", () => {
  assert.equal(classifyLoginIdentifier("a@b.com", "student-login"), "email");
  assert.equal(classifyLoginIdentifier("1234567890", "student-login"), "nisn");
  assert.equal(classifyLoginIdentifier("19800101", "admin-login"), "nip");
  assert.equal(classifyLoginIdentifier("x@y.z", "google"), "email");
});

test("loginMethodLabel describes credentials vs google", () => {
  assert.equal(loginMethodLabel("student-login", "email"), "email + password");
  assert.equal(loginMethodLabel("student-login", "nisn"), "NISN + password");
  assert.equal(loginMethodLabel("admin-login", "nip"), "NIP + password");
  assert.equal(loginMethodLabel("google", "email"), "Google");
});

test("buildUserFieldChanges includes name diff and password/photo flags without secrets", () => {
  const changes = buildUserFieldChanges({
    before: { name: "A", email: "a@x.com", photoPresent: false },
    after: { name: "B", email: "a@x.com", photoPresent: true },
    passwordChanged: true,
    photoChanged: true,
  });
  const byField = Object.fromEntries(changes.map((c) => [c.field, c]));
  assert.equal(byField.name?.from, "A");
  assert.equal(byField.name?.to, "B");
  assert.equal(byField.password?.to, "(direset / diganti)");
  assert.equal(byField.photoPresent?.to, "ditambahkan");
  assert.ok(!JSON.stringify(changes).includes("secret"));
});

test("formatChangesSummary joins labels", () => {
  const s = formatChangesSummary([
    { field: "name", label: "Nama", from: "A", to: "B" },
    { field: "password", label: "Password", from: "(tersembunyi)", to: "(direset / diganti)" },
  ]);
  assert.match(s, /Nama: A → B/);
  assert.match(s, /Password: diganti/);
});
