import assert from "node:assert/strict";
import test from "node:test";
import {
  plainTextToDocumentHtml,
  fillDocumentHtml,
  isLikelyHtmlDocument,
  buildSampleVars,
} from "../lib/document-html";
import { parsePageSettings, resolvePageBox, serializePageSettings, DEFAULT_PAGE_SETTINGS } from "../lib/document-page";
import { poinTerbilang, buildStudentPrintVars } from "../lib/student-print-vars";

test("plainTextToDocumentHtml converts placeholders to spans", () => {
  const html = plainTextToDocumentHtml("Nama: {{nama}}\nKelas: {{kelas}}");
  assert.match(html, /data-placeholder="nama"/);
  assert.match(html, /data-placeholder="kelas"/);
  assert.match(html, /<p>/);
});

test("fillDocumentHtml replaces placeholder spans", () => {
  const html = plainTextToDocumentHtml("Halo {{nama}}");
  const filled = fillDocumentHtml(html, { nama: "Budi" });
  assert.match(filled, /Budi/);
  assert.doesNotMatch(filled, /data-placeholder/);
});

test("isLikelyHtmlDocument detects html", () => {
  assert.equal(isLikelyHtmlDocument("<p>x</p>"), true);
  assert.equal(isLikelyHtmlDocument("Nama: {{nama}}"), false);
});

test("page settings roundtrip", () => {
  const raw = serializePageSettings({ ...DEFAULT_PAGE_SETTINGS, paper: "F4", orientation: "landscape" });
  const parsed = parsePageSettings(raw);
  assert.equal(parsed.paper, "F4");
  assert.equal(parsed.orientation, "landscape");
  const box = resolvePageBox(parsed);
  assert.equal(box.widthMm, 330);
  assert.equal(box.heightMm, 215);
});

test("buildSampleVars includes core keys", () => {
  const vars = buildSampleVars();
  assert.equal(vars.nama, "Budi Santoso");
  assert.ok(vars.sekolah);
});

test("poinTerbilang", () => {
  assert.equal(poinTerbilang(0), "nol");
  assert.equal(poinTerbilang(15), "lima belas");
  assert.equal(poinTerbilang(75), "tujuh puluh lima");
});

test("buildStudentPrintVars", () => {
  const vars = buildStudentPrintVars({
    name: "Ani",
    nisn: "123",
    className: "XI IPA 2",
    effectivePoints: 40,
  });
  assert.equal(vars.nama, "Ani");
  assert.equal(vars.poin, "40");
  assert.equal(vars.kelas, "XI IPA 2");
});
