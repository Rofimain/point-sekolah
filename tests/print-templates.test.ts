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
  migrateInfoPoinSignatory,
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

test("surat info poin memakai tanda tangan wali kelas, bukan kepala sekolah", () => {
  const info = DEFAULT_PRINT_TEMPLATES.find((t) => t.slug === "info-poin");
  assert.ok(info);
  assert.match(info!.body, /Wali Kelas \{\{kelas\}\}/);
  assert.match(info!.body, /\{\{wali_kelas\}\}/);
  assert.doesNotMatch(info!.body, /\{\{kepala_sekolah\}\}/);
  assert.ok(TEMPLATE_OFFICIAL_PLACEHOLDERS["info-poin"]?.includes("wali_kelas"));
  assert.ok(!TEMPLATE_OFFICIAL_PLACEHOLDERS["info-poin"]?.includes("kepala_sekolah"));
});

test("migrateInfoPoinSignatory mengganti placeholder kepala sekolah jadi wali kelas", () => {
  const html =
    `<p class="doc-sign-role">Wali Kelas {{kelas}}</p>` +
    `<span data-placeholder="kepala_sekolah">{{kepala_sekolah}}</span>`;
  const next = migrateInfoPoinSignatory(html, "SMA Islam Al Azhar 1 Jakarta");
  assert.match(next, /data-placeholder="wali_kelas"/);
  assert.match(next, /\{\{wali_kelas\}\}/);
  assert.doesNotMatch(next, /kepala_sekolah/);
});

test("migrateInfoPoinSignatory merapikan jabatan Kepala sekolah default", () => {
  const next = migrateInfoPoinSignatory(
    `<p class="doc-sign-role">Kepala SMA Contoh</p>{{kepala_sekolah}}`,
    "SMA Contoh"
  );
  assert.match(next, /Wali Kelas \{\{kelas\}\}/);
  assert.match(next, /\{\{wali_kelas\}\}/);
  assert.doesNotMatch(next, /Kepala SMA Contoh/);
});
