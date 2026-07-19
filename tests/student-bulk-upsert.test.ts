import test from "node:test";
import assert from "node:assert/strict";
import { displayNameFromEmail, isBulkStudentEmailAllowed } from "../lib/student-bulk-email";

test("displayNameFromEmail derives readable name", () => {
  assert.equal(displayNameFromEmail("ahmad.fauzi@siswa.example.id"), "Ahmad Fauzi");
  assert.equal(displayNameFromEmail("budi@siswa.example.id"), "Budi");
});

test("bulk student email allowlist uses student domain when configured", () => {
  const prev = process.env.NEXT_PUBLIC_STUDENT_DOMAIN;
  process.env.NEXT_PUBLIC_STUDENT_DOMAIN = "smaalazhar1.sch.id";
  try {
    assert.equal(isBulkStudentEmailAllowed("andi@smaalazhar1.sch.id"), true);
    assert.equal(isBulkStudentEmailAllowed("andi@gmail.com"), false);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_STUDENT_DOMAIN;
    else process.env.NEXT_PUBLIC_STUDENT_DOMAIN = prev;
  }
});
