import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { Node, mergeAttributes } from "@tiptap/core";

/** Attribute helper: keep HTML `class` so letter layout CSS survives TipTap round-trip. */
function classAttribute() {
  return {
    class: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.getAttribute("class"),
      renderHTML: (attributes: { class?: string | null }) => {
        if (!attributes.class) return {};
        return { class: attributes.class };
      },
    },
  };
}

export const ParagraphWithClass = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...classAttribute(),
    };
  },
});

export const HeadingWithClass = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...classAttribute(),
    };
  },
});

export const TableWithClass = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...classAttribute(),
    };
  },
}).configure({ resizable: true });

export const TableRowWithClass = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...classAttribute(),
    };
  },
});

export const TableCellWithClass = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...classAttribute(),
    };
  },
});

export const TableHeaderWithClass = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...classAttribute(),
    };
  },
});

/**
 * Generic block container for signature / layout wrappers (`div.doc-sign`).
 * TipTap drops unknown divs; this keeps them editable as a single block.
 */
export const DivBlock = Node.create({
  name: "divBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return classAttribute();
  },

  parseHTML() {
    return [
      {
        tag: "div",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const cls = el.getAttribute("class") || "";
          // Hanya wrapper layout surat; jangan telan div TipTap/table lain.
          if (/\bdoc-/.test(cls)) return {};
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
});
