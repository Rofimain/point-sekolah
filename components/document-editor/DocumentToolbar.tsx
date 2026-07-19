"use client";

import type { Editor } from "@tiptap/react";
import {
  PAPER_SIZES_MM,
  MARGIN_PRESETS_MM,
  type DocumentPageSettings,
  type MarginPreset,
  type PageOrientation,
  type PaperSize,
} from "@/lib/document-page";

const FONTS = [
  "Times New Roman",
  "Arial",
  "Georgia",
  "Calibri",
  "Courier New",
  "Tahoma",
  "Verdana",
];

const FONT_SIZES = ["10pt", "11pt", "12pt", "14pt", "16pt", "18pt", "20pt", "24pt"];

type Props = {
  editor: Editor | null;
  pageSettings: DocumentPageSettings;
  onPageSettingsChange: (next: DocumentPageSettings) => void;
  onOpenHeaderFooter?: () => void;
};

function ToolBtn({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-xs font-semibold disabled:opacity-40"
      style={{
        background: active ? "var(--accent-light)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-primary)",
        border: "1px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px self-center" style={{ background: "var(--border)" }} />;
}

export function DocumentToolbar({ editor, pageSettings, onPageSettingsChange, onOpenHeaderFooter }: Props) {
  if (!editor) return null;

  const update = (patch: Partial<DocumentPageSettings>) =>
    onPageSettingsChange({ ...pageSettings, ...patch });

  return (
    <div
      className="sticky top-0 z-10 space-y-2 rounded-t-lg border border-b-0 p-2"
      style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolBtn title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </ToolBtn>
        <ToolBtn title="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </ToolBtn>
        <Sep />

        <select
          title="Font"
          className="h-8 max-w-[9rem] rounded border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          value={editor.getAttributes("textStyle").fontFamily || "Times New Roman"}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        >
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>

        <select
          title="Ukuran font"
          className="h-8 rounded border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          value={editor.getAttributes("textStyle").fontSize || "12pt"}
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace("pt", "")}
            </option>
          ))}
        </select>
        <Sep />

        <ToolBtn title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn
          title="Underline (Ctrl+U)"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </ToolBtn>

        <label className="inline-flex h-8 items-center gap-1 px-1 text-[10px]" style={{ color: "var(--text-secondary)" }} title="Warna teks">
          A
          <input
            type="color"
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            value={editor.getAttributes("textStyle").color || "#111111"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <label className="inline-flex h-8 items-center gap-1 px-1 text-[10px]" style={{ color: "var(--text-secondary)" }} title="Highlight">
          H
          <input
            type="color"
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            defaultValue="#fff59d"
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </label>
        <Sep />

        <ToolBtn title="Rata kiri" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          ☰
        </ToolBtn>
        <ToolBtn
          title="Tengah"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ≡
        </ToolBtn>
        <ToolBtn
          title="Kanan"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ☰
        </ToolBtn>
        <ToolBtn
          title="Justify"
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          ≣
        </ToolBtn>
        <Sep />

        <select
          title="Paragraf / Heading"
          className="h-8 rounded border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
          }}
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <ToolBtn
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •≡
        </ToolBtn>
        <ToolBtn
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1≡
        </ToolBtn>
        <ToolBtn title="Indent" onClick={() => editor.chain().focus().sinkListItem("listItem").run()}>
          →
        </ToolBtn>
        <ToolBtn title="Outdent" onClick={() => editor.chain().focus().liftListItem("listItem").run()}>
          ←
        </ToolBtn>
        <Sep />

        <ToolBtn title="Garis horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ―
        </ToolBtn>
        <ToolBtn
          title="Tabel 3×3"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          ▦
        </ToolBtn>
        <ToolBtn title="Page break" onClick={() => editor.chain().focus().insertPageBreak().run()}>
          ⤓
        </ToolBtn>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Page Setup
        </span>
        <select
          className="h-8 rounded border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          value={pageSettings.paper}
          onChange={(e) => update({ paper: e.target.value as PaperSize })}
        >
          {(Object.keys(PAPER_SIZES_MM) as PaperSize[]).map((k) => (
            <option key={k} value={k}>
              {PAPER_SIZES_MM[k].label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          value={pageSettings.orientation}
          onChange={(e) => update({ orientation: e.target.value as PageOrientation })}
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
        <select
          className="h-8 rounded border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          value={pageSettings.margin}
          onChange={(e) => {
            const margin = e.target.value as MarginPreset;
            if (margin === "custom") {
              update({
                margin,
                customMarginMm: pageSettings.customMarginMm ?? MARGIN_PRESETS_MM.kop,
              });
            } else {
              update({ margin });
            }
          }}
        >
          <option value="kop">Margin Kop Surat</option>
          <option value="normal">Margin Normal</option>
          <option value="narrow">Margin Narrow</option>
          <option value="wide">Margin Wide</option>
          <option value="custom">Margin Custom</option>
        </select>
        {pageSettings.margin === "custom" && (
          <div className="flex flex-wrap items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <label key={side} className="inline-flex items-center gap-0.5">
                {side[0].toUpperCase()}
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="h-7 w-12 rounded border px-1 text-[11px]"
                  style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  value={pageSettings.customMarginMm?.[side] ?? MARGIN_PRESETS_MM.kop[side]}
                  onChange={(e) =>
                    update({
                      customMarginMm: {
                        top: pageSettings.customMarginMm?.top ?? MARGIN_PRESETS_MM.kop.top,
                        right: pageSettings.customMarginMm?.right ?? MARGIN_PRESETS_MM.kop.right,
                        bottom: pageSettings.customMarginMm?.bottom ?? MARGIN_PRESETS_MM.kop.bottom,
                        left: pageSettings.customMarginMm?.left ?? MARGIN_PRESETS_MM.kop.left,
                        [side]: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </label>
            ))}
            <span>mm</span>
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={pageSettings.showPageNumbers}
            onChange={(e) => update({ showPageNumbers: e.target.checked })}
          />
          Nomor halaman
        </label>
        {onOpenHeaderFooter && (
          <button
            type="button"
            onClick={onOpenHeaderFooter}
            className="h-8 rounded border px-2 text-[11px] font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-secondary)" }}
          >
            Header / Footer
          </button>
        )}
      </div>
    </div>
  );
}
