export type PaperSize = "A4" | "Letter" | "Legal" | "F4";
export type PageOrientation = "portrait" | "landscape";
export type MarginPreset = "normal" | "narrow" | "wide" | "custom";

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
  F4: { width: 215, height: 330, label: "F4 / Folio" },
};

export const MARGIN_PRESETS_MM: Record<Exclude<MarginPreset, "custom">, DocumentMarginsMm> = {
  normal: { top: 25, right: 25, bottom: 25, left: 25 },
  narrow: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  wide: { top: 38, right: 38, bottom: 38, left: 38 },
};

export const DEFAULT_PAGE_SETTINGS: DocumentPageSettings = {
  paper: "A4",
  orientation: "portrait",
  margin: "normal",
  headerHtml: "",
  footerHtml: "",
  showPageNumbers: true,
};

export function resolveMargins(settings: DocumentPageSettings): DocumentMarginsMm {
  if (settings.margin === "custom" && settings.customMarginMm) {
    return settings.customMarginMm;
  }
  const preset = settings.margin === "custom" ? "normal" : settings.margin;
  return MARGIN_PRESETS_MM[preset];
}

export function resolvePageBox(settings: DocumentPageSettings): { widthMm: number; heightMm: number } {
  const paper = PAPER_SIZES_MM[settings.paper] ?? PAPER_SIZES_MM.A4;
  if (settings.orientation === "landscape") {
    return { widthMm: paper.height, heightMm: paper.width };
  }
  return { widthMm: paper.width, heightMm: paper.height };
}

export function parsePageSettings(raw: string | null | undefined): DocumentPageSettings {
  if (!raw?.trim()) return { ...DEFAULT_PAGE_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<DocumentPageSettings>;
    return {
      ...DEFAULT_PAGE_SETTINGS,
      ...parsed,
      customMarginMm: parsed.customMarginMm ?? DEFAULT_PAGE_SETTINGS.customMarginMm,
      headerHtml: typeof parsed.headerHtml === "string" ? parsed.headerHtml : "",
      footerHtml: typeof parsed.footerHtml === "string" ? parsed.footerHtml : "",
      showPageNumbers: parsed.showPageNumbers !== false,
    };
  } catch {
    return { ...DEFAULT_PAGE_SETTINGS };
  }
}

export function serializePageSettings(settings: DocumentPageSettings): string {
  return JSON.stringify(settings);
}

/** CSS @page size string, e.g. "A4 portrait" or "215mm 330mm". */
export function pageSizeCss(settings: DocumentPageSettings): string {
  const { widthMm, heightMm } = resolvePageBox(settings);
  if (settings.paper === "A4" || settings.paper === "Letter" || settings.paper === "Legal") {
    const name = settings.paper === "Letter" ? "letter" : settings.paper === "Legal" ? "legal" : "A4";
    return `${name} ${settings.orientation}`;
  }
  return `${widthMm}mm ${heightMm}mm`;
}

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
  background: #fff;
  color: #111;
  box-shadow: ${forPrint ? "none" : "0 1px 3px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08)"};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}
.doc-page-header {
  padding: ${margins.top}mm ${margins.right}mm 4mm ${margins.left}mm;
  min-height: ${Math.max(margins.top, 8)}mm;
  font-size: 10pt;
  color: #333;
  border-bottom: 1px solid transparent;
}
.doc-page-body {
  flex: 1;
  padding: 0 ${margins.right}mm 0 ${margins.left}mm;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.55;
  outline: none;
}
.doc-page-body p { margin: 0 0 0.65em; }
.doc-page-body h1 { font-size: 18pt; font-weight: 700; margin: 0 0 0.6em; }
.doc-page-body h2 { font-size: 14pt; font-weight: 700; margin: 0 0 0.55em; }
.doc-page-body h3 { font-size: 12pt; font-weight: 700; margin: 0 0 0.5em; }
.doc-page-body ul, .doc-page-body ol { margin: 0 0 0.65em; padding-left: 1.4em; }
.doc-page-body table { border-collapse: collapse; width: 100%; margin: 0 0 0.65em; }
.doc-page-body td, .doc-page-body th { border: 1px solid #333; padding: 4px 8px; vertical-align: top; }
.doc-page-body hr { border: none; border-top: 1px solid #333; margin: 1em 0; }
.doc-page-footer {
  padding: 4mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
  min-height: ${Math.max(margins.bottom, 8)}mm;
  font-size: 9pt;
  color: #444;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
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
  margin: 12px 0;
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
@media print {
  .doc-page-break { border: none; margin: 0; height: 0; }
  .doc-page-break::after { display: none; }
  .doc-editor-canvas { background: transparent !important; padding: 0 !important; max-height: none !important; overflow: visible !important; }
  .doc-page {
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
  @page {
    size: ${pageSizeCss(settings)};
    margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
  }
}
`.trim();
}
