import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, slugifyPrintTemplate, escapeHtml, sortPrintTemplates } from "../lib/print-templates";

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
