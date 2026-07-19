import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateUserWithRole,
  canDeleteUser,
  canManageUsers,
  canModifyUser,
  roleRank,
} from "../lib/staff-roles";

test("roleRank orders student < teacher < admin < super admin", () => {
  assert.ok(roleRank("STUDENT") < roleRank("TEACHER"));
  assert.ok(roleRank("TEACHER") < roleRank("ADMIN"));
  assert.ok(roleRank("ADMIN") < roleRank("SUPER_ADMIN"));
});

test("canManageUsers allows all staff including TEACHER", () => {
  assert.equal(canManageUsers("TEACHER"), true);
  assert.equal(canManageUsers("ADMIN"), true);
  assert.equal(canManageUsers("SUPER_ADMIN"), true);
  assert.equal(canManageUsers("STUDENT"), false);
});

test("TEACHER can create student and peer teacher but not admin+", () => {
  assert.equal(canCreateUserWithRole("TEACHER", "STUDENT"), true);
  assert.equal(canCreateUserWithRole("TEACHER", "TEACHER"), true);
  assert.equal(canCreateUserWithRole("TEACHER", "ADMIN"), false);
  assert.equal(canCreateUserWithRole("TEACHER", "SUPER_ADMIN"), false);
});

test("ADMIN can create peer admin but not super admin", () => {
  assert.equal(canCreateUserWithRole("ADMIN", "STUDENT"), true);
  assert.equal(canCreateUserWithRole("ADMIN", "TEACHER"), true);
  assert.equal(canCreateUserWithRole("ADMIN", "ADMIN"), true);
  assert.equal(canCreateUserWithRole("ADMIN", "SUPER_ADMIN"), false);
});

test("TEACHER cannot modify or delete peer teacher", () => {
  assert.equal(canModifyUser("TEACHER", "TEACHER"), false);
  assert.equal(canDeleteUser("TEACHER", "TEACHER"), false);
  assert.equal(canModifyUser("TEACHER", "STUDENT"), true);
  assert.equal(canDeleteUser("TEACHER", "STUDENT"), true);
  assert.equal(canModifyUser("TEACHER", "ADMIN"), false);
});

test("ADMIN cannot modify or delete peer admin; SUPER_ADMIN can", () => {
  assert.equal(canModifyUser("ADMIN", "ADMIN"), false);
  assert.equal(canDeleteUser("ADMIN", "SUPER_ADMIN"), false);
  assert.equal(canModifyUser("SUPER_ADMIN", "SUPER_ADMIN"), true);
  assert.equal(canDeleteUser("SUPER_ADMIN", "ADMIN"), true);
});
