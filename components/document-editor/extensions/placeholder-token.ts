import { Node, mergeAttributes } from "@tiptap/core";

export type PlaceholderTokenOptions = {
  HTMLAttributes: Record<string, string>;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    placeholderToken: {
      insertPlaceholder: (key: string) => ReturnType;
    };
  }
}

export const PlaceholderToken = Node.create<PlaceholderTokenOptions>({
  name: "placeholderToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-placeholder"),
        renderHTML: (attributes) => {
          if (!attributes.key) return {};
          return { "data-placeholder": String(attributes.key).toLowerCase() };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-placeholder]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = String(node.attrs.key || "").toLowerCase();
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "doc-placeholder",
        contenteditable: "false",
        "data-placeholder": key,
      }),
      `{{${key}}}`,
    ];
  },

  addCommands() {
    return {
      insertPlaceholder:
        (key: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { key: key.toLowerCase() },
          }),
    };
  },
});
