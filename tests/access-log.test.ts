import test from "node:test";
import assert from "node:assert/strict";
import { portalFromAuthProvider, portalFromActorRole, accessLogActorFromSession } from "../lib/access-log-meta";
import { buildAccessLogWhere, parseAccessLogQuery } from "../lib/access-log-query";
import {
  ACCESS_LOG_ACTIVE_MONTHS,
  ACCESS_LOG_RETAIN_MONTHS,
  accessLogActiveSince,
  accessLogRetainSince,
  accessLogScopeWindow,
  parseAccessLogScope,
} from "../lib/access-log-retention";

test("portalFromAuthProvider maps credentials and google", () => {
  assert.equal(portalFromAuthProvider("student-login"), "STUDENT");
  assert.equal(portalFromAuthProvider("admin-login"), "STAFF");
  assert.equal(portalFromAuthProvider("google", "staff"), "STAFF");
  assert.equal(portalFromAuthProvider("google", "student"), "STUDENT");
  assert.equal(portalFromAuthProvider("google"), "STUDENT");
  assert.equal(portalFromAuthProvider("unknown"), "SYSTEM");
});

test("portalFromActorRole maps roles", () => {
  assert.equal(portalFromActorRole("STUDENT"), "STUDENT");
  assert.equal(portalFromActorRole("TEACHER"), "STAFF");
  assert.equal(portalFromActorRole("ADMIN"), "STAFF");
  assert.equal(portalFromActorRole("SUPER_ADMIN"), "STAFF");
  assert.equal(portalFromActorRole(null), "SYSTEM");
});

test("accessLogActorFromSession requires user id", () => {
  assert.equal(accessLogActorFromSession(null), null);
  assert.equal(accessLogActorFromSession({ user: { name: "X" } }), null);
  assert.deepEqual(accessLogActorFromSession({ user: { id: "u1", name: "Budi", role: "STUDENT" } }), {
    id: "u1",
    name: "Budi",
    role: "STUDENT",
  });
});

test("parseAccessLogQuery clamps pagination and scope", () => {
  const q = parseAccessLogQuery(new URLSearchParams("page=0&perPage=999&scope=archive"));
  assert.equal(q.page, 1);
  assert.equal(q.perPage, 50);
  assert.equal(q.scope, "archive");
  assert.equal(parseAccessLogScope(null), "active");
});

test("retention windows are 12 and 24 months", () => {
  assert.equal(ACCESS_LOG_ACTIVE_MONTHS, 12);
  assert.equal(ACCESS_LOG_RETAIN_MONTHS, 24);
  const now = new Date("2026-07-19T12:00:00.000Z");
  const active = accessLogActiveSince(now);
  const retain = accessLogRetainSince(now);
  assert.ok(active.getTime() > retain.getTime());
  const winActive = accessLogScopeWindow("active", now);
  assert.equal(winActive.gte.getTime(), active.getTime());
  assert.equal(winActive.lt, undefined);
  const winArchive = accessLogScopeWindow("archive", now);
  assert.equal(winArchive.gte.getTime(), retain.getTime());
  assert.equal(winArchive.lt?.getTime(), active.getTime());
});

test("buildAccessLogWhere applies active scope by default", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  const where = buildAccessLogWhere(
    {
      category: "LOGIN",
      portal: "STUDENT",
      q: "budi",
      page: 1,
      perPage: 30,
    },
    now
  );
  assert.equal(where.category, "LOGIN");
  assert.equal(where.portal, "STUDENT");
  assert.ok(Array.isArray(where.AND));
  const created = (where.AND as { createdAt?: { gte?: Date } }[]).find((c) => c.createdAt?.gte);
  assert.ok(created?.createdAt?.gte);
  assert.equal(created!.createdAt!.gte!.getTime(), accessLogActiveSince(now).getTime());
});
