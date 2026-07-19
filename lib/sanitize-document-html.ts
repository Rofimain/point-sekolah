import DOMPurify from "isomorphic-dompurify";

/**
 * Whitelist HTML untuk template surat TipTap.
 * Sumber konten: admin/guru lewat editor internal (bukan input siswa).
 * Sanitize di save + render (defense in depth).
 */
const DOCUMENT_HTML_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "span",
    "div",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
  ],
  ALLOWED_ATTR: [
    "class",
    "style",
    "colspan",
    "rowspan",
    "colwidth",
    "data-placeholder",
    "data-page-break",
    "contenteditable",
    "align",
  ],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "img", "a", "link", "meta", "base"],
  FORBID_ATTR: ["src", "href", "xlink:href", "action", "formaction"],
};

/** Sanitize HTML dokumen surat sebelum disimpan / di-render lewat dangerouslySetInnerHTML. */
export function sanitizeDocumentHtml(html: string): string {
  if (!html?.trim()) return html || "";
  return DOMPurify.sanitize(html, DOCUMENT_HTML_CONFIG);
}
