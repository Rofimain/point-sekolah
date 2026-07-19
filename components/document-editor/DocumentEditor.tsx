"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Gapcursor from "@tiptap/extension-gapcursor";
import { PlaceholderToken } from "@/components/document-editor/extensions/placeholder-token";
import { PageBreak } from "@/components/document-editor/extensions/page-break";
import { FontSize } from "@/components/document-editor/extensions/font-size";
import { DocumentToolbar } from "@/components/document-editor/DocumentToolbar";
import {
  buildDocumentPageCss,
  type DocumentPageSettings,
  DEFAULT_PAGE_SETTINGS,
} from "@/lib/document-page";
import { plainTextToDocumentHtml } from "@/lib/document-html";

export type DocumentEditorHandle = {
  getHTML: () => string;
  getPageSettings: () => DocumentPageSettings;
  setPageSettings: (settings: DocumentPageSettings) => void;
  insertPlaceholder: (key: string) => void;
  focus: () => void;
  isEmpty: () => boolean;
};

export type DocumentEditorProps = {
  initialHtml: string;
  initialPageSettings?: DocumentPageSettings;
  editable?: boolean;
  className?: string;
  onChange?: (html: string, pageSettings: DocumentPageSettings) => void;
  onSaveRequest?: () => void;
};

export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  function DocumentEditor(
    {
      initialHtml,
      initialPageSettings = DEFAULT_PAGE_SETTINGS,
      editable = true,
      className,
      onChange,
      onSaveRequest,
    },
    ref
  ) {
    const [pageSettings, setPageSettings] = useState<DocumentPageSettings>(initialPageSettings);
    const [showHf, setShowHf] = useState(false);
    const [headerDraft, setHeaderDraft] = useState(initialPageSettings.headerHtml || "");
    const [footerDraft, setFooterDraft] = useState(initialPageSettings.footerHtml || "");

    const content = useMemo(() => plainTextToDocumentHtml(initialHtml || ""), [initialHtml]);

    const editor = useEditor({
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          horizontalRule: false,
        }),
        Underline,
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        HorizontalRule,
        Gapcursor,
        PlaceholderToken,
        PageBreak,
      ],
      content,
      editorProps: {
        attributes: {
          class: "doc-page-body ProseMirror",
          spellcheck: "true",
        },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            onSaveRequest?.();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getHTML(), pageSettings);
      },
    });

    useEffect(() => {
      setPageSettings(initialPageSettings);
      setHeaderDraft(initialPageSettings.headerHtml || "");
      setFooterDraft(initialPageSettings.footerHtml || "");
    }, [initialPageSettings]);

    // Konten di-load lewat `content` saat mount; parent wajib remount via `key` saat ganti dokumen.

    const emitChange = useCallback(
      (nextSettings: DocumentPageSettings) => {
        setPageSettings(nextSettings);
        onChange?.(editor?.getHTML() ?? "", nextSettings);
      },
      [editor, onChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        getHTML: () => editor?.getHTML() ?? "",
        getPageSettings: () => pageSettings,
        setPageSettings: (s) => emitChange(s),
        insertPlaceholder: (key: string) => {
          editor?.chain().focus().insertPlaceholder(key).run();
        },
        focus: () => editor?.commands.focus(),
        isEmpty: () => !editor || editor.isEmpty,
      }),
      [editor, pageSettings, emitChange]
    );

    const pageCss = useMemo(() => buildDocumentPageCss(pageSettings), [pageSettings]);

    function applyHeaderFooter() {
      emitChange({
        ...pageSettings,
        headerHtml: headerDraft,
        footerHtml: footerDraft,
      });
      setShowHf(false);
    }

    return (
      <div className={className}>
        {editable && (
          <DocumentToolbar
            editor={editor}
            pageSettings={pageSettings}
            onPageSettingsChange={emitChange}
            onOpenHeaderFooter={() => {
              setHeaderDraft(pageSettings.headerHtml || "");
              setFooterDraft(pageSettings.footerHtml || "");
              setShowHf(true);
            }}
          />
        )}

        {showHf && (
          <div
            className="space-y-2 border border-t-0 px-3 py-2"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Header & Footer
            </p>
            <label className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Header (HTML / teks, boleh pakai {"{{placeholder}}"})
              <textarea
                value={headerDraft}
                onChange={(e) => setHeaderDraft(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
              />
            </label>
            <label className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Footer
              <textarea
                value={footerDraft}
                onChange={(e) => setFooterDraft(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyHeaderFooter}
                className="rounded px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                Terapkan
              </button>
              <button
                type="button"
                onClick={() => setShowHf(false)}
                className="rounded border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Batal
              </button>
            </div>
          </div>
        )}

        <div className="doc-editor-shell overflow-hidden rounded-b-lg border" style={{ borderColor: "var(--border)" }}>
          <style>{pageCss}</style>
          <div className="doc-editor-canvas" data-document-editor-canvas>
            <div className="doc-page" data-document-page>
              <div
                className={`doc-page-header${pageSettings.headerHtml?.trim() ? "" : " is-empty"}`}
                dangerouslySetInnerHTML={{
                  __html: pageSettings.headerHtml?.trim()
                    ? plainTextToDocumentHtml(pageSettings.headerHtml)
                    : "",
                }}
              />
              <EditorContent editor={editor} />
              <div
                className={[
                  "doc-page-footer",
                  !pageSettings.footerHtml?.trim() && !pageSettings.showPageNumbers ? "is-empty" : "",
                  !pageSettings.footerHtml?.trim() && pageSettings.showPageNumbers
                    ? "doc-footer-pagenum-only"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: pageSettings.footerHtml?.trim()
                      ? plainTextToDocumentHtml(pageSettings.footerHtml)
                      : "",
                  }}
                />
                <div>{pageSettings.showPageNumbers ? "Hal." : ""}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default DocumentEditor;
