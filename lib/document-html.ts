import { escapeHtml, PRINT_PLACEHOLDERS } from "@/lib/print-templates";
import {
  buildDocumentPageCss,
  type DocumentPageSettings,
  DEFAULT_PAGE_SETTINGS,
  parsePageSettings,
} from "@/lib/document-page";

const PLACEHOLDER_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function isLikelyHtmlDocument(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return true;
  return /<\/?(p|div|h[1-6]|ul|ol|li|table|span|br|hr)\b/i.test(trimmed);
}

export function placeholderSpanHtml(key: string): string {
  const safe = escapeHtml(key.toLowerCase());
  return `<span data-placeholder="${safe}" class="doc-placeholder" contenteditable="false">{{${safe}}}</span>`;
}

function formatFilledValue(value: string): string {
  return escapeHtml(value).replace(/\r\n/g, "\n").replace(/\n/g, "<br>");
}

/** Konversi redaksi plain text lama → HTML dokumen dengan token placeholder. */
export function plainTextToDocumentHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  if (isLikelyHtmlDocument(text)) return ensurePlaceholderSpans(collapseEmptyParagraphs(text));

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let emptyRun = 0;

  for (const line of lines) {
    if (!line.trim()) {
      emptyRun += 1;
      continue;
    }
    if (emptyRun > 0) {
      // Satu gap tanda tangan, bukan 4× <p> kosong yang mendorong ke halaman 2
      if (emptyRun >= 3) parts.push('<p class="doc-sign-gap"></p>');
      else if (emptyRun === 2) parts.push("<p></p><p></p>");
      else parts.push("<p></p>");
      emptyRun = 0;
    }
    const withTokens = escapeHtml(line).replace(PLACEHOLDER_RE, (_m, key: string) =>
      placeholderSpanHtml(key)
    );
    parts.push(`<p>${withTokens}</p>`);
  }
  if (emptyRun >= 3) parts.push('<p class="doc-sign-gap"></p>');
  else if (emptyRun === 2) parts.push("<p></p><p></p>");
  else if (emptyRun === 1) parts.push("<p></p>");

  return parts.join("") || "<p></p>";
}

/** Rapikan run <p></p> beruntun di HTML legacy. */
export function collapseEmptyParagraphs(html: string): string {
  return html
    .replace(/(?:<p>\s*<\/p>\s*){3,}/gi, '<p class="doc-sign-gap"></p>')
    .replace(/(?:<p><br\s*\/?><\/p>\s*){3,}/gi, '<p class="doc-sign-gap"></p>');
}

/** Pastikan {{key}} di HTML jadi span token (tanpa merusak yang sudah span). */
export function ensurePlaceholderSpans(html: string): string {
  return html.replace(PLACEHOLDER_RE, (match, key: string, offset: number, full: string) => {
    const before = full.slice(Math.max(0, offset - 80), offset);
    if (/data-placeholder\s*=\s*["'][^"']*$/i.test(before) || /<span[^>]*data-placeholder[^>]*>\s*$/i.test(before)) {
      return match;
    }
    const openIdx = full.lastIndexOf("<span", offset);
    const closeIdx = full.lastIndexOf("</span>", offset);
    if (openIdx > closeIdx && /data-placeholder/i.test(full.slice(openIdx, offset))) {
      return match;
    }
    return placeholderSpanHtml(key);
  });
}

export function fillDocumentHtml(html: string, vars: Record<string, string>): string {
  const filledSpans = html.replace(
    /<span\b[^>]*\bdata-placeholder\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi,
    (_m, key: string) => {
      const value = vars[key.toLowerCase()];
      return value != null && value !== "" ? formatFilledValue(value) : escapeHtml(`{{${key}}}`);
    }
  );
  return filledSpans.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const value = vars[key.toLowerCase()];
    return value != null && value !== "" ? formatFilledValue(value) : escapeHtml(`{{${key}}}`);
  });
}

export const SAMPLE_PRINT_VARS: Record<string, string> = {
  nama: "Budi Santoso",
  kelas: "X IPA 1",
  nis: "0051234567",
  poin: "75",
  poin_terbilang: "tujuh puluh lima",
  tanggal: "19 Juli 2026",
  nomor_surat: "123/SP1/VII/2026",
  daftar_pelanggaran:
    "1. Terlambat masuk kelas (10 poin) — 02/07/2026\n2. Tidak memakai atribut lengkap (15 poin) — 08/07/2026",
  sekolah: "SMA Islam Al Azhar 1 Jakarta",
  kepala_sekolah: "Drs. H. Contoh Kepala, M.Pd.",
  alamat: "Jl. Melati No. 10, Jakarta Selatan",
  tanggal_hijriah: "Jakarta, 7 Dzulqo'dah 1446 H",
  tanggal_masehi: "5 Mei 2025 M",
  pasal: "16 ayat 12",
  bunyi_pasal:
    "Membawa rokok atau merokok / vape / jenis lainnya di lingkungan sekolah atau luar sekolah, sesuai dengan aturan range pasal 2.",
  lama_skorsing: "3",
  tanggal_mulai_skorsing: "20 Juli 2026",
  tanggal_masuk_kembali: "23 Juli 2026",
  hari_tanggal_pertemuan: "Senin, 20 Juli 2026",
  waktu_pertemuan: "07.30 – 08.00 WIB",
  tempat: "R. Tamu Kepala SMA Islam Al Azhar 1 Jakarta",
  nama_pic: "Bapak Ahmad Fauzi",
  materi_diskusi: "Akumulasi poin dan komitmen perbaikan",
  urutan_poin: "1",
  periode_awal: "1 Agustus 2025",
  periode_akhir: "3 Desember 2025",
  batas_remisi: "03 Januari 2026",
  jenis_sp: "SP-2",
  tanggal_perjanjian: "Jakarta, 19 Juli 2026",
};

export function buildSampleVars(overrides?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = { ...SAMPLE_PRINT_VARS };
  for (const p of PRINT_PLACEHOLDERS) {
    if (base[p.key] == null) base[p.key] = `(${p.label})`;
  }
  return { ...base, ...overrides };
}

export function buildPrintableDocumentHtml(options: {
  title: string;
  bodyHtml: string;
  pageSettings: DocumentPageSettings;
  vars?: Record<string, string> | null;
}): string {
  const settings = options.pageSettings ?? DEFAULT_PAGE_SETTINGS;
  const body = options.vars
    ? fillDocumentHtml(plainTextToDocumentHtml(options.bodyHtml), options.vars)
    : plainTextToDocumentHtml(options.bodyHtml);
  const headerRaw = settings.headerHtml || "";
  const footerRaw = settings.footerHtml || "";
  const header = options.vars ? fillDocumentHtml(plainTextToDocumentHtml(headerRaw), options.vars) : plainTextToDocumentHtml(headerRaw);
  const footer = options.vars ? fillDocumentHtml(plainTextToDocumentHtml(footerRaw), options.vars) : plainTextToDocumentHtml(footerRaw);
  const css = buildDocumentPageCss(settings, { forPrint: true });
  const hasHeader = Boolean(headerRaw.trim());
  const hasFooter = Boolean(footerRaw.trim());
  const showPageNum = settings.showPageNumbers;
  const footerClass = [
    "doc-page-footer",
    !hasFooter && !showPageNum ? "is-empty" : "",
    !hasFooter && showPageNum ? "doc-footer-pagenum-only" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title)}</title>
<style>
${css}
html, body { margin: 0; background: #fff; }
</style>
</head>
<body>
  <div class="doc-editor-canvas">
    <div class="doc-page">
      <div class="doc-page-header${hasHeader ? "" : " is-empty"}">${hasHeader ? header : ""}</div>
      <div class="doc-page-body">${body}</div>
      <div class="${footerClass}">
        <div>${hasFooter ? footer : ""}</div>
        <div>${showPageNum ? "Hal." : ""}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function normalizeTemplateBody(body: string): string {
  return plainTextToDocumentHtml(body);
}

export function normalizeTemplatePageSettings(raw: string | null | undefined): DocumentPageSettings {
  return parsePageSettings(raw);
}
