import test from "node:test";
import assert from "node:assert/strict";
import {
  renderTemplate,
  slugifyPrintTemplate,
  escapeHtml,
  sortPrintTemplates,
  findUnrecognizedPlaceholders,
  extractPlaceholderKeys,
  TEMPLATE_OFFICIAL_PLACEHOLDERS,
  DEFAULT_PRINT_TEMPLATES,
} from "../lib/print-templates";

test("renderTemplate mengganti placeholder", () => {
  const out = renderTemplate("Nama: {{nama}}, kelas {{kelas}}", {
    nama: "Ali",
    kelas: "X.1",
  });
  assert.equal(out, "Nama: Ali, kelas X.1");
});

test("renderTemplate mempertahankan placeholder kosong", () => {
  const out = renderTemplate("Poin {{poin}}", {});
  assert.equal(out, "Poin {{poin}}");
});

test("slugifyPrintTemplate menormalisasi judul", () => {
  assert.equal(slugifyPrintTemplate("Surat Info Poin"), "surat-info-poin");
});

test("escapeHtml mengamankan karakter khusus", () => {
  assert.equal(escapeHtml(`a <b> & "c"`), "a &lt;b&gt; &amp; &quot;c&quot;");
});

test("sortPrintTemplates mengurutkan sortOrder lalu judul", () => {
  const rows = sortPrintTemplates([
    { sortOrder: 20, title: "B" },
    { sortOrder: 10, title: "Z" },
    { sortOrder: 10, title: "A" },
  ]);
  assert.deepEqual(
    rows.map((r) => r.title),
    ["A", "Z", "B"]
  );
});

test("findUnrecognizedPlaceholders soft-warn for typos", () => {
  const unknown = findUnrecognizedPlaceholders("Halo {{nama}} dan {{nama_siswa}}", "sp1");
  assert.deepEqual(unknown, ["nama_siswa"]);
});

test("default templates use only official placeholders for their slug", () => {
  for (const t of DEFAULT_PRINT_TEMPLATES) {
    const official = new Set(TEMPLATE_OFFICIAL_PLACEHOLDERS[t.slug] || []);
    const used = extractPlaceholderKeys(t.body);
    for (const key of used) {
      assert.ok(official.has(key), `${t.slug} uses non-official {{${key}}}`);
    }
  }
});
