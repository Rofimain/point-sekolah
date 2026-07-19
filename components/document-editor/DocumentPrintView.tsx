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
};

function formatHf(raw: string, vars?: Record<string, string> | null): string {
  if (!raw?.trim()) return "";
  let html = raw.includes("<") ? raw : plainTextToDocumentHtml(raw);
  if (vars) html = fillDocumentHtml(html, vars);
  return html;
}

/** Render dokumen siap cetak / pratinjau (tanpa editor). */
export function DocumentPrintView({
  bodyHtml,
  pageSettings = DEFAULT_PAGE_SETTINGS,
  vars = null,
  className,
  printId = "document-print-view",
}: Props) {
  const css = useMemo(() => buildDocumentPageCss(pageSettings, { forPrint: true }), [pageSettings]);
  const body = useMemo(() => {
    const base = plainTextToDocumentHtml(bodyHtml);
    return vars ? fillDocumentHtml(base, vars) : base;
  }, [bodyHtml, vars]);
  const header = useMemo(() => formatHf(pageSettings.headerHtml || "", vars), [pageSettings.headerHtml, vars]);
  const footer = useMemo(() => formatHf(pageSettings.footerHtml || "", vars), [pageSettings.footerHtml, vars]);

  return (
    <div id={printId} className={className}>
      <style>{css}</style>
      <div className="doc-editor-canvas">
        <div className="doc-page">
          <div className="doc-page-header" dangerouslySetInnerHTML={{ __html: header || "&nbsp;" }} />
          <div className="doc-page-body" dangerouslySetInnerHTML={{ __html: body }} />
          <div className="doc-page-footer">
            <div dangerouslySetInnerHTML={{ __html: footer }} />
            <div>{pageSettings.showPageNumbers ? "Halaman" : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
