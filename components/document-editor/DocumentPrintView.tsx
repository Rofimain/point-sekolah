"use client";

import { useMemo } from "react";
import {
  buildDocumentPageCss,
  type DocumentPageSettings,
  DEFAULT_PAGE_SETTINGS,
} from "@/lib/document-page";
import { fillDocumentHtml, plainTextToDocumentHtml } from "@/lib/document-html";

type Props = {
  bodyHtml: string;
  pageSettings?: DocumentPageSettings;
  vars?: Record<string, string> | null;
  className?: string;
  /** id untuk target print CSS */
  printId?: string;
  /**
   * screen = tampilan sama editor (kertas + shadow).
   * print-surface = dipakai di blok print:block (CSS @media print aktif saat cetak).
   */
  variant?: "screen" | "print-surface";
};

function formatHf(raw: string, vars?: Record<string, string> | null): string {
  if (!raw?.trim()) return "";
  let html = plainTextToDocumentHtml(raw);
  if (vars) html = fillDocumentHtml(html, vars);
  return html;
}

/** Render dokumen — layout sama dengan text editor (satu CSS page model). */
export function DocumentPrintView({
  bodyHtml,
  pageSettings = DEFAULT_PAGE_SETTINGS,
  vars = null,
  className,
  printId = "document-print-view",
  variant = "screen",
}: Props) {
  const forPrint = variant === "print-surface";
  const css = useMemo(() => buildDocumentPageCss(pageSettings, { forPrint }), [pageSettings, forPrint]);
  const body = useMemo(() => {
    const base = plainTextToDocumentHtml(bodyHtml);
    return vars ? fillDocumentHtml(base, vars) : base;
  }, [bodyHtml, vars]);
  const header = useMemo(() => formatHf(pageSettings.headerHtml || "", vars), [pageSettings.headerHtml, vars]);
  const footer = useMemo(() => formatHf(pageSettings.footerHtml || "", vars), [pageSettings.footerHtml, vars]);
  const hasHeader = Boolean(pageSettings.headerHtml?.trim());
  const hasFooter = Boolean(pageSettings.footerHtml?.trim());
  const showPageNum = pageSettings.showPageNumbers;
  const footerClass = [
    "doc-page-footer",
    !hasFooter && !showPageNum ? "is-empty" : "",
    !hasFooter && showPageNum ? "doc-footer-pagenum-only" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id={printId} className={className}>
      <style>{css}</style>
      <div className="doc-editor-canvas">
        <div className="doc-page">
          <div
            className={`doc-page-header${hasHeader ? "" : " is-empty"}`}
            dangerouslySetInnerHTML={{ __html: hasHeader ? header : "" }}
          />
          <div className="doc-page-body" dangerouslySetInnerHTML={{ __html: body }} />
          <div className={footerClass}>
            <div dangerouslySetInnerHTML={{ __html: hasFooter ? footer : "" }} />
            <div>{showPageNum ? "Hal." : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
