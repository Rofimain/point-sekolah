import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { canCreateUserWithRole, canDeleteUser, canManageUsers, canModifyUser } from "../lib/staff-roles";
import { parseEvidenceImageDataUrl, validateEvidenceImageList } from "../lib/evidence-data-url";
import { sanitizeDocumentHtml } from "../lib/sanitize-document-html";
import { PointBadge, StatusBadge, CRITICAL_POINTS, WARNING_POINTS } from "../components/PointThresholdBadges";
import { parseRecordsListPagination } from "../lib/records-pagination";
import { softDeleteViolationRecord } from "../lib/user-soft-delete";
import { createPrismaClient } from "../lib/prisma";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/** (a) RBAC: TEACHER ditolak create/update/delete; SUPER_ADMIN diizinkan (gate yang dipakai API users). */
test("RBAC API gate: TEACHER cannot manage users; SUPER_ADMIN can", () => {
  assert.equal(canManageUsers("TEACHER"), false);
  assert.equal(canCreateUserWithRole("TEACHER", "TEACHER"), false);
  assert.equal(canModifyUser("TEACHER", "TEACHER"), false);
  assert.equal(canDeleteUser("TEACHER", "STUDENT"), false);

  assert.equal(canManageUsers("SUPER_ADMIN"), true);
  assert.equal(canCreateUserWithRole("SUPER_ADMIN", "TEACHER"), true);
  assert.equal(canModifyUser("SUPER_ADMIN", "ADMIN"), true);
  assert.equal(canDeleteUser("SUPER_ADMIN", "TEACHER"), true);
});

/** (c) Evidence: MIME non-image / spoof ditolak; PNG valid diterima. */
test("evidence validation rejects text/plain and pdf disguised as image; accepts PNG", () => {
  assert.throws(() => parseEvidenceImageDataUrl("data:text/plain;base64,aGVsbG8="));
  assert.throws(() =>
    parseEvidenceImageDataUrl(`data:application/pdf;base64,${Buffer.from("%PDF-1.4").toString("base64")}`)
  );
  assert.throws(() =>
    parseEvidenceImageDataUrl(`data:image/png;base64,${Buffer.from("%PDF-fake").toString("base64")}`)
  );

  const ok = validateEvidenceImageList([PNG_1X1]);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.images.length, 1);
  assert.equal(parseEvidenceImageDataUrl(PNG_1X1).mime, "image/png");
});

/** (d) Sanitasi HTML: script/onerror hilang; bold/italic/table tetap. */
test("document HTML sanitize removes XSS but keeps formatting tags", () => {
  const dirty =
    '<p><strong>Bold</strong> <em>Italic</em></p>' +
    '<table><tr><td>Sel</td></tr></table>' +
    '<script>alert(1)</script><img src=x onerror="alert(2)">' +
    '<p onclick="evil()">teks</p>';
  const clean = sanitizeDocumentHtml(dirty);
  assert.match(clean, /<strong>Bold<\/strong>/);
  assert.match(clean, /<em>Italic<\/em>/);
  assert.match(clean, /<table>/);
  assert.match(clean, /<td>Sel<\/td>/);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onerror/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /<img/i);
});

/** (e) Badge mengikuti env NEXT_PUBLIC_* (bukan hardcode 50/75 di komponen). */
test("point threshold badges follow NEXT_PUBLIC warning/critical env defaults module", () => {
  // Modul membaca env saat load — verifikasi konstanta ekspor selaras process.env atau default.
  const warn = parseInt(process.env.NEXT_PUBLIC_WARNING_POINTS || "50", 10);
  const crit = parseInt(process.env.NEXT_PUBLIC_CRITICAL_POINTS || "75", 10);
  assert.equal(WARNING_POINTS, warn);
  assert.equal(CRITICAL_POINTS, crit);

  // Render dengan ambang custom lewat props (sama path UI Records/Students/Dashboard).
  const mid = renderToStaticMarkup(
    React.createElement(StatusBadge, { points: 40, alertPoints: 30, criticalPoints: 60 })
  );
  assert.match(mid, /Perhatian/);
  const high = renderToStaticMarkup(
    React.createElement(PointBadge, { points: 70, alertPoints: 30, criticalPoints: 60 })
  );
  assert.match(high, />70</);
  const low = renderToStaticMarkup(
    React.createElement(StatusBadge, { points: 10, alertPoints: 30, criticalPoints: 60 })
  );
  assert.match(low, /Normal/);
});

/** (g) Pagination clamp — halaman 2 skip berbeda dari halaman 1. */
test("records list pagination: page 2 has different skip than page 1 and clamps perPage", () => {
  const p1 = parseRecordsListPagination(new URLSearchParams("page=1&perPage=10"));
  const p2 = parseRecordsListPagination(new URLSearchParams("page=2&perPage=10"));
  assert.equal(p1.page, 1);
  assert.equal(p1.skip, 0);
  assert.equal(p2.page, 2);
  assert.equal(p2.skip, 10);
  assert.notEqual(p1.skip, p2.skip);
  assert.equal(parseRecordsListPagination(new URLSearchParams("perPage=999")).perPage, 100);
  assert.equal(parseRecordsListPagination(new URLSearchParams("page=0")).page, 1);
});

/** (f) Cron secret gate — tanpa / salah → 403; benar → lanjut (mock apply via env only). */
test("cron quiet-month route rejects missing or wrong secret", async () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "correct-cron-secret";
  const { POST } = await import("../app/api/cron/quiet-month-points/route");

  const noHdr = await POST(new NextRequest("http://localhost/api/cron/quiet-month-points", { method: "POST" }));
  assert.equal(noHdr.status, 403);

  const bad = await POST(
    new NextRequest("http://localhost/api/cron/quiet-month-points", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    })
  );
  assert.equal(bad.status, 403);

  if (prev === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prev;
});

test("telegram webhook rejects missing or wrong secret", async () => {
  const prev = process.env.TELEGRAM_WEBHOOK_SECRET;
  process.env.TELEGRAM_WEBHOOK_SECRET = "correct-webhook-secret-aaaaaaaa";
  const { POST } = await import("../app/api/telegram/webhook/route");

  const noHdr = await POST(new NextRequest("http://localhost/api/telegram/webhook", { method: "POST", body: "{}" }));
  assert.equal(noHdr.status, 403);

  const bad = await POST(
    new NextRequest("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "wrong" },
      body: "{}",
    })
  );
  assert.equal(bad.status, 403);

  if (prev === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = prev;
});

/** (b) Soft-delete ViolationRecord — butuh DATABASE_URL (smoke DB). */
test("soft-delete violation record: hidden from list queries but row remains with deletedAt", async (t) => {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "postgresql://") {
    t.skip("DATABASE_URL tidak tersedia untuk integration soft-delete");
    return;
  }
  const prisma = createPrismaClient();
  try {
    const student = await prisma.user.findFirst({
      where: { role: "STUDENT", deletedAt: null },
      select: { id: true },
    });
    const vt = await prisma.violationType.findFirst({ where: { active: true }, select: { id: true, points: true } });
    assert.ok(student && vt, "seed smoke harus punya siswa + jenis pelanggaran");

    const created = await prisma.violationRecord.create({
      data: {
        studentId: student!.id,
        violationTypeId: vt!.id,
        points: vt!.points,
        notes: "hardening-soft-delete-test",
        date: new Date(),
      },
    });

    const ok = await softDeleteViolationRecord(created.id);
    assert.equal(ok, true);

    const listed = await prisma.violationRecord.findMany({
      where: { deletedAt: null, id: created.id },
    });
    assert.equal(listed.length, 0);

    const exportLike = await prisma.violationRecord.findMany({
      where: { deletedAt: null, notes: "hardening-soft-delete-test" },
    });
    assert.equal(exportLike.length, 0);

    const row = await prisma.violationRecord.findUnique({ where: { id: created.id } });
    assert.ok(row);
    assert.ok(row!.deletedAt instanceof Date);
  } finally {
    await prisma.$disconnect();
  }
});

/** (g) Pagination data berbeda antar halaman — butuh DB dengan cukup baris. */
test("records pagination pages return disjoint id sets when enough rows exist", async (t) => {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "postgresql://") {
    t.skip("DATABASE_URL tidak tersedia");
    return;
  }
  const prisma = createPrismaClient();
  try {
    const total = await prisma.violationRecord.count({ where: { deletedAt: null } });
    if (total < 3) {
      t.skip("butuh ≥3 catatan aktif untuk uji halaman");
      return;
    }
    const perPage = 1;
    const page1 = await prisma.violationRecord.findMany({
      where: { deletedAt: null },
      orderBy: { date: "desc" },
      skip: 0,
      take: perPage,
      select: { id: true },
    });
    const page2 = await prisma.violationRecord.findMany({
      where: { deletedAt: null },
      orderBy: { date: "desc" },
      skip: perPage,
      take: perPage,
      select: { id: true },
    });
    assert.equal(page1.length, 1);
    assert.equal(page2.length, 1);
    assert.notEqual(page1[0]!.id, page2[0]!.id);
  } finally {
    await prisma.$disconnect();
  }
});
