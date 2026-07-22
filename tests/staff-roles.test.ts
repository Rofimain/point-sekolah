import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateUserWithRole,
  canCreateViolationRecord,
  canDeleteUser,
  canManageUsers,
  canModifyUser,
  formatStaffDisplayName,
  getRoleLabel,
  roleRank,
} from "../lib/staff-roles";

test("roleRank orders student < teacher < admin < super admin", () => {
  assert.ok(roleRank("STUDENT") < roleRank("TEACHER"));
  assert.ok(roleRank("TEACHER") < roleRank("ADMIN"));
  assert.ok(roleRank("ADMIN") < roleRank("SUPER_ADMIN"));
});

test("role labels are Super Admin / Admin / Guru / Siswa", () => {
  assert.equal(getRoleLabel("SUPER_ADMIN"), "Super Admin");
  assert.equal(getRoleLabel("ADMIN"), "Admin");
  assert.equal(getRoleLabel("TEACHER"), "Guru");
  assert.equal(getRoleLabel("STUDENT"), "Siswa");
});

test("canManageUsers: only ADMIN and SUPER_ADMIN", () => {
  assert.equal(canManageUsers("SUPER_ADMIN"), true);
  assert.equal(canManageUsers("ADMIN"), true);
  assert.equal(canManageUsers("TEACHER"), false);
  assert.equal(canManageUsers("STUDENT"), false);
});

test("SUPER_ADMIN can create and manage all roles", () => {
  for (const role of ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const) {
    assert.equal(canCreateUserWithRole("SUPER_ADMIN", role), true);
    assert.equal(canModifyUser("SUPER_ADMIN", role), true);
    assert.equal(canDeleteUser("SUPER_ADMIN", role), true);
  }
});

test("ADMIN can create ADMIN/TEACHER/STUDENT but not SUPER_ADMIN", () => {
  assert.equal(canCreateUserWithRole("ADMIN", "STUDENT"), true);
  assert.equal(canCreateUserWithRole("ADMIN", "TEACHER"), true);
  assert.equal(canCreateUserWithRole("ADMIN", "ADMIN"), true);
  assert.equal(canCreateUserWithRole("ADMIN", "SUPER_ADMIN"), false);
});

test("ADMIN can fully manage TEACHER and STUDENT only", () => {
  assert.equal(canModifyUser("ADMIN", "STUDENT"), true);
  assert.equal(canDeleteUser("ADMIN", "STUDENT"), true);
  assert.equal(canModifyUser("ADMIN", "TEACHER"), true);
  assert.equal(canDeleteUser("ADMIN", "TEACHER"), true);
  assert.equal(canModifyUser("ADMIN", "ADMIN"), false);
  assert.equal(canDeleteUser("ADMIN", "ADMIN"), false);
  assert.equal(canModifyUser("ADMIN", "SUPER_ADMIN"), false);
  assert.equal(canDeleteUser("ADMIN", "SUPER_ADMIN"), false);
});

test("TEACHER cannot create, modify, or delete any user", () => {
  for (const role of ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const) {
    assert.equal(canCreateUserWithRole("TEACHER", role), false);
    assert.equal(canModifyUser("TEACHER", role), false);
    assert.equal(canDeleteUser("TEACHER", role), false);
  }
});

test("STUDENT has no user-management rights", () => {
  assert.equal(canManageUsers("STUDENT"), false);
  assert.equal(canCreateUserWithRole("STUDENT", "STUDENT"), false);
  assert.equal(canModifyUser("STUDENT", "STUDENT"), false);
  assert.equal(canDeleteUser("STUDENT", "STUDENT"), false);
});

test("formatStaffDisplayName appends jabatan when present", () => {
  assert.equal(formatStaffDisplayName({ name: "Budi", jabatan: "Piket" }), "Budi (Piket)");
  assert.equal(formatStaffDisplayName({ name: "Ani", jabatan: "  " }), "Ani");
  assert.equal(formatStaffDisplayName({ name: "Siti" }), "Siti");
});

test("canCreateViolationRecord: siswa dan staf boleh, role lain tidak", () => {
  assert.equal(canCreateViolationRecord("STUDENT"), true);
  assert.equal(canCreateViolationRecord("TEACHER"), true);
  assert.equal(canCreateViolationRecord("ADMIN"), true);
  assert.equal(canCreateViolationRecord("SUPER_ADMIN"), true);
  assert.equal(canCreateViolationRecord("INACTIVE"), false);
  assert.equal(canCreateViolationRecord(null), false);
});
