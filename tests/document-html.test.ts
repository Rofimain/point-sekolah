import assert from "node:assert/strict";
import test from "node:test";
import { plainTextToDocumentHtml, fillDocumentHtml, isLikelyHtmlDocument, buildSampleVars } from "../lib/document-html";
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

test("fillDocumentHtml preserves newlines as br", () => {
  const html = plainTextToDocumentHtml("{{daftar_pelanggaran}}");
  const filled = fillDocumentHtml(html, {
    daftar_pelanggaran: "1. A\n2. B",
  });
  assert.match(filled, /1\. A<br>2\. B/);
});

test("plainTextToDocumentHtml collapses long empty runs to sign gap", () => {
  const html = plainTextToDocumentHtml("Atas\n\n\n\nBawah");
  assert.match(html, /doc-sign-gap/);
  assert.doesNotMatch(html, /(<p><\/p>\s*){3}/);
});

test("isLikelyHtmlDocument detects html", () => {
  assert.equal(isLikelyHtmlDocument("<p>x</p>"), true);
  assert.equal(isLikelyHtmlDocument("Nama: {{nama}}"), false);
});

test("page settings default is F4 kop", () => {
  const parsed = parsePageSettings(null);
  assert.equal(parsed.paper, "F4");
  assert.equal(parsed.margin, "kop");
  const box = resolvePageBox(parsed);
  assert.equal(box.widthMm, 216);
  assert.equal(box.heightMm, 330);
});

test("page settings roundtrip", () => {
  const raw = serializePageSettings({ ...DEFAULT_PAGE_SETTINGS, paper: "F4", orientation: "landscape" });
  const parsed = parsePageSettings(raw);
  assert.equal(parsed.paper, "F4");
  assert.equal(parsed.orientation, "landscape");
  const box = resolvePageBox(parsed);
  assert.equal(box.widthMm, 330);
  assert.equal(box.heightMm, 216);
});

test("fillDocumentHtml fills placeholders inside letter tables", () => {
  const html = plainTextToDocumentHtml(
    `<table class="doc-sign-table"><tr><td>Kepala {{sekolah}}</td><td>{{kepala_sekolah}}</td></tr></table>`
  );
  const filled = fillDocumentHtml(html, {
    sekolah: "SMA Contoh",
    kepala_sekolah: "Drs. Contoh",
  });
  assert.match(filled, /SMA Contoh/);
  assert.match(filled, /Drs\. Contoh/);
  assert.doesNotMatch(filled, /\{\{/);
});

test("default templates use HTML letter layout tables", async () => {
  const { DEFAULT_PRINT_TEMPLATES } = await import("../lib/print-templates");
  const info = DEFAULT_PRINT_TEMPLATES.find((t) => t.slug === "info-poin");
  assert.ok(info);
  assert.match(info!.body, /doc-sign-table/);
  assert.match(info!.body, /doc-letterhead-meta|doc-meta-table/);
  const sp1 = DEFAULT_PRINT_TEMPLATES.find((t) => t.slug === "sp1");
  assert.match(sp1!.body, /doc-sign-one-table|doc-sign-table/);
  assert.match(sp1!.body, /doc-identity-table/);
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
  // Tanggal surat: nama bulan penuh, tanpa singkatan (mis. "6 Agustus 2026")
  assert.match(
    vars.tanggal,
    /^\d{1,2} (Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember) \d{4}$/
  );
});

test("sanitizeDocumentHtml strips script and event handlers from letter HTML", async () => {
  const { sanitizeDocumentHtml } = await import("../lib/sanitize-document-html");
  const dirty =
    '<p style="color:red" onclick="alert(1)">Halo <script>alert(2)</script><strong>OK</strong></p>' +
    '<img src=x onerror=alert(3) /><a href="javascript:alert(4)">x</a>';
  const clean = sanitizeDocumentHtml(dirty);
  assert.match(clean, /<strong>OK<\/strong>/);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /<img/i);
  assert.doesNotMatch(clean, /<a /i);
  assert.doesNotMatch(clean, /javascript:/i);
});
