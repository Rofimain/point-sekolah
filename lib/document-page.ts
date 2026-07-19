export type PaperSize = "A4" | "Letter" | "Legal" | "F4";
export type PageOrientation = "portrait" | "landscape";
export type MarginPreset = "kop" | "normal" | "narrow" | "wide" | "custom";

export type DocumentMarginsMm = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type DocumentPageSettings = {
  paper: PaperSize;
  orientation: PageOrientation;
  margin: MarginPreset;
  customMarginMm?: DocumentMarginsMm;
  headerHtml: string;
  footerHtml: string;
  showPageNumbers: boolean;
};

/** Dimensi kertas dalam mm (lebar × tinggi, portrait). */
export const PAPER_SIZES_MM: Record<PaperSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: "A4" },
  Letter: { width: 215.9, height: 279.4, label: "Letter" },
  Legal: { width: 215.9, height: 355.6, label: "Legal" },
  /** Folio Indonesia umum untuk surat sekolah. */
  F4: { width: 216, height: 330, label: "F4 / Folio" },
};

export const MARGIN_PRESETS_MM: Record<Exclude<MarginPreset, "custom">, DocumentMarginsMm> = {
  /** Default untuk kertas kop tercetak (atas lega). */
  kop: { top: 35, right: 25, bottom: 25, left: 25 },
  normal: { top: 20, right: 20, bottom: 20, left: 20 },
  narrow: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  wide: { top: 30, right: 30, bottom: 30, left: 30 },
};

export const DEFAULT_PAGE_SETTINGS: DocumentPageSettings = {
  paper: "F4",
  orientation: "portrait",
  margin: "kop",
  headerHtml: "",
  footerHtml: "",
  showPageNumbers: false,
};

export function resolveMargins(settings: DocumentPageSettings): DocumentMarginsMm {
  if (settings.margin === "custom" && settings.customMarginMm) {
    return settings.customMarginMm;
  }
  const preset = settings.margin === "custom" ? "kop" : settings.margin;
  return MARGIN_PRESETS_MM[preset] ?? MARGIN_PRESETS_MM.kop;
}

export function resolvePageBox(settings: DocumentPageSettings): { widthMm: number; heightMm: number } {
  const paper = PAPER_SIZES_MM[settings.paper] ?? PAPER_SIZES_MM.F4;
  if (settings.orientation === "landscape") {
    return { widthMm: paper.height, heightMm: paper.width };
  }
  return { widthMm: paper.width, heightMm: paper.height };
}

export function parsePageSettings(raw: string | null | undefined): DocumentPageSettings {
  if (!raw?.trim()) return { ...DEFAULT_PAGE_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentPageSettings>;
    const margin = parsed.margin;
    const validMargin: MarginPreset =
      margin === "kop" || margin === "normal" || margin === "narrow" || margin === "wide" || margin === "custom"
        ? margin
        : DEFAULT_PAGE_SETTINGS.margin;
    return {
      ...DEFAULT_PAGE_SETTINGS,
      ...parsed,
      paper: parsed.paper && parsed.paper in PAPER_SIZES_MM ? parsed.paper : DEFAULT_PAGE_SETTINGS.paper,
      orientation: parsed.orientation === "landscape" ? "landscape" : "portrait",
      margin: validMargin,
      customMarginMm: parsed.customMarginMm ?? DEFAULT_PAGE_SETTINGS.customMarginMm,
      headerHtml: typeof parsed.headerHtml === "string" ? parsed.headerHtml : "",
      footerHtml: typeof parsed.footerHtml === "string" ? parsed.footerHtml : "",
      showPageNumbers: parsed.showPageNumbers === true,
    };
  } catch {
    return { ...DEFAULT_PAGE_SETTINGS };
  }
}

export function serializePageSettings(settings: DocumentPageSettings): string {
  return JSON.stringify(settings);
}

/** CSS @page size string, e.g. "A4 portrait" or "216mm 330mm". */
export function pageSizeCss(settings: DocumentPageSettings): string {
  const { widthMm, heightMm } = resolvePageBox(settings);
  if (settings.paper === "A4" || settings.paper === "Letter" || settings.paper === "Legal") {
    const name = settings.paper === "Letter" ? "letter" : settings.paper === "Legal" ? "legal" : "A4";
    return `${name} ${settings.orientation}`;
  }
  return `${widthMm}mm ${heightMm}mm`;
}

/**
 * Satu set CSS untuk editor + pratinjau + cetak.
 * Margin hanya sekali: di layar via padding .doc-page; saat cetak via @page (padding konten di-nol-kan).
 */
export function buildDocumentPageCss(settings: DocumentPageSettings, options?: { forPrint?: boolean }): string {
  const { widthMm, heightMm } = resolvePageBox(settings);
  const margins = resolveMargins(settings);
  const forPrint = options?.forPrint ?? false;

  return `
.doc-editor-canvas {
  background: #e8eaed;
  padding: ${forPrint ? "0" : "24px 16px 48px"};
  overflow: auto;
  max-height: ${forPrint ? "none" : "min(72vh, 900px)"};
}
.doc-page {
  width: ${widthMm}mm;
  min-height: ${heightMm}mm;
  margin: ${forPrint ? "0" : "0 auto 24px"};
  padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
  background: #fff;
  color: #111;
  box-shadow: ${forPrint ? "none" : "0 1px 3px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08)"};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}
.doc-page-header {
  flex: 0 0 auto;
  margin: 0 0 3mm;
  font-size: 10pt;
  color: #333;
  line-height: 1.35;
}
.doc-page-header.is-empty { display: none; }
.doc-page-body {
  flex: 1 1 auto;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.45;
  outline: none;
  min-width: 0;
}
.doc-page-body p { margin: 0 0 0.45em; text-align: justify; }
.doc-page-body p:empty { margin: 0; height: 0.7em; }
.doc-page-body p.doc-sign-gap { margin: 0; height: 14mm; }
.doc-page-body p.doc-title { text-align: center; font-weight: 700; font-size: 13pt; margin: 1em 0 0.75em; }
.doc-page-body p.doc-subtitle { text-align: center; font-style: italic; margin-top: -0.4em; }
.doc-page-body p.doc-align-right { text-align: right; }
.doc-page-body p.doc-note { font-size: 10pt; margin-top: 1em; }
.doc-page-body h1 { font-size: 16pt; font-weight: 700; margin: 0 0 0.5em; text-align: center; }
.doc-page-body h2 { font-size: 13pt; font-weight: 700; margin: 0 0 0.45em; }
.doc-page-body h3 { font-size: 12pt; font-weight: 700; margin: 0 0 0.4em; }
.doc-page-body ul, .doc-page-body ol { margin: 0 0 0.45em; padding-left: 1.35em; }
.doc-page-body table { border-collapse: collapse; width: 100%; margin: 0 0 0.65em; }
.doc-page-body td, .doc-page-body th { border: 1px solid #333; padding: 4px 8px; vertical-align: top; }
.doc-page-body table.doc-meta-table,
.doc-page-body table.doc-identity-table,
.doc-page-body table.doc-letterhead-meta,
.doc-page-body table.doc-sign-table {
  border: none;
  width: 100%;
}
.doc-page-body table.doc-meta-table td,
.doc-page-body table.doc-identity-table td,
.doc-page-body table.doc-letterhead-meta td,
.doc-page-body table.doc-sign-table td {
  border: none;
  padding: 1px 0;
  vertical-align: top;
}
.doc-page-body .doc-meta-label { width: 28mm; white-space: nowrap; }
.doc-page-body .doc-meta-colon { width: 4mm; }
.doc-page-body .doc-meta-left { width: 62%; }
.doc-page-body .doc-meta-right { width: 38%; text-align: right; vertical-align: top; }
.doc-page-body .doc-identity-table td:first-child { width: 42mm; white-space: nowrap; }
.doc-page-body .doc-sign { margin-top: 8mm; }
.doc-page-body .doc-sign-one { width: 55%; margin-left: auto; text-align: center; }
.doc-page-body table.doc-sign-one-table { width: 48%; margin-left: auto; margin-top: 8mm; }
.doc-page-body table.doc-sign-table { margin-top: 8mm; }
.doc-page-body .doc-sign-space { height: 16mm; margin: 0; padding: 0; border: none; }
.doc-page-body .doc-sign-role,
.doc-page-body .doc-sign-name { text-align: center; margin: 0; }
.doc-page-body .doc-sign-role {
  font-size: 10.5pt;
  line-height: 1.25;
  white-space: nowrap;
}
.doc-page-body .doc-sign-table td.doc-sign-cell:first-child:nth-last-child(3) .doc-sign-role,
.doc-page-body .doc-sign-table td.doc-sign-cell:first-child:nth-last-child(3) ~ td .doc-sign-role {
  font-size: 9.5pt;
  letter-spacing: -0.01em;
}
.doc-page-body .doc-sign-cell { width: 50%; text-align: center; }
.doc-page-body .doc-sign-table td.doc-sign-cell:first-child:nth-last-child(3),
.doc-page-body .doc-sign-table td.doc-sign-cell:first-child:nth-last-child(3) ~ td { width: 33.33%; }
.doc-page-body hr { border: none; border-top: 1px solid #333; margin: 0.85em 0; }
.doc-page-body .ProseMirror { outline: none; min-height: 40mm; }
.doc-page-footer {
  flex: 0 0 auto;
  margin-top: auto;
  padding-top: 3mm;
  font-size: 9pt;
  color: #444;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.doc-page-footer.is-empty { display: none; }
.doc-page-footer.doc-footer-pagenum-only {
  justify-content: flex-end;
  color: #888;
  font-size: 8pt;
}
.doc-placeholder {
  display: inline-block;
  padding: 0 6px;
  margin: 0 1px;
  border-radius: 4px;
  background: #dbeafe;
  color: #1d4ed8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.92em;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: baseline;
  border: 1px solid #93c5fd;
}
.doc-page-break {
  display: block;
  height: 0;
  margin: 10px 0;
  border: none;
  border-top: 2px dashed #94a3b8;
  page-break-before: always;
  break-before: page;
  position: relative;
}
.doc-page-break::after {
  content: "Page break";
  position: absolute;
  top: -0.7em;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  color: #64748b;
  font-size: 10px;
  padding: 0 8px;
  font-family: system-ui, sans-serif;
}
.doc-page-body p:last-child,
.doc-page-body p:nth-last-child(-n+4) {
  break-inside: avoid;
  page-break-inside: avoid;
}

@media print {
  .doc-page-break { border: none; margin: 0; height: 0; }
  .doc-page-break::after { display: none; }
  .doc-editor-canvas {
    background: transparent !important;
    padding: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .doc-page {
    width: auto !important;
    min-height: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    display: block !important;
  }
  .doc-page-header { margin-bottom: 3mm; }
  .doc-page-body { flex: none; }
  .doc-page-footer {
    margin-top: 6mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .doc-page-footer.doc-footer-pagenum-only { display: none !important; }
  .doc-placeholder {
    background: none !important;
    border: none !important;
    color: inherit !important;
    font-family: inherit !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  @page {
    size: ${pageSizeCss(settings)};
    margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
  }
}
`.trim();
}
