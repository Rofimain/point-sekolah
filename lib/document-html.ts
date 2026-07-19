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

/** Konversi redaksi plain text lama → HTML dokumen dengan token placeholder. */
export function plainTextToDocumentHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  if (isLikelyHtmlDocument(text)) return ensurePlaceholderSpans(text);

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return lines
    .map((line) => {
      if (!line.trim()) return "<p></p>";
      const withTokens = escapeHtml(line).replace(PLACEHOLDER_RE, (_m, key: string) =>
        placeholderSpanHtml(key)
      );
      return `<p>${withTokens}</p>`;
    })
    .join("");
}

/** Pastikan {{key}} di HTML jadi span token (tanpa merusak yang sudah span). */
export function ensurePlaceholderSpans(html: string): string {
  return html.replace(PLACEHOLDER_RE, (match, key: string, offset: number, full: string) => {
    const before = full.slice(Math.max(0, offset - 80), offset);
    if (/data-placeholder\s*=\s*["'][^"']*$/i.test(before) || /<span[^>]*data-placeholder[^>]*>\s*$/i.test(before)) {
      return match;
    }
    // Skip if already inside a placeholder span content
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
      return value != null && value !== "" ? escapeHtml(value) : escapeHtml(`{{${key}}}`);
    }
  );
  return filledSpans.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const value = vars[key.toLowerCase()];
    return value != null && value !== "" ? escapeHtml(value) : escapeHtml(`{{${key}}}`);
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
  hari_skorsing: "3",
  tanggal_skorsing: "20 Juli 2026",
  tanggal_kembali: "23 Juli 2026",
  pic: "Bapak Ahmad Fauzi",
  materi: "Akumulasi poin dan komitmen perbaikan",
  alamat: "Jl. Melati No. 10, Jakarta Selatan",
  kepala_sekolah: "Drs. H. Contoh Kepala, M.Pd.",
  sekolah: "SMA Islam Al Azhar 1 Jakarta",
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
  const body = options.vars ? fillDocumentHtml(options.bodyHtml, options.vars) : options.bodyHtml;
  const header = options.vars
    ? fillDocumentHtml(settings.headerHtml || "", options.vars)
    : settings.headerHtml || "";
  const footer = options.vars
    ? fillDocumentHtml(settings.footerHtml || "", options.vars)
    : settings.footerHtml || "";
  const css = buildDocumentPageCss(settings, { forPrint: true });
  const pageNum = settings.showPageNumbers ? `<span class="doc-page-num"></span>` : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title)}</title>
<style>
${css}
body { margin: 0; background: #fff; }
.doc-page-num::after { content: "Hal. " counter(page); }
</style>
</head>
<body>
  <div class="doc-editor-canvas">
    <div class="doc-page">
      <div class="doc-page-header">${header || "&nbsp;"}</div>
      <div class="doc-page-body">${body}</div>
      <div class="doc-page-footer"><div>${footer || ""}</div><div>${pageNum}</div></div>
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
