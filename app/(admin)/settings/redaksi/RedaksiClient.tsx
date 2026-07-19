"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRINT_PLACEHOLDERS,
  TEMPLATE_OFFICIAL_PLACEHOLDERS,
  findUnrecognizedPlaceholders,
  sortPrintTemplates,
} from "@/lib/print-templates";
import { DocumentEditor, DocumentPrintView, type DocumentEditorHandle } from "@/components/document-editor";
import {
  DEFAULT_PAGE_SETTINGS,
  parsePageSettings,
  serializePageSettings,
  type DocumentPageSettings,
} from "@/lib/document-page";
import { buildPrintableDocumentHtml, buildSampleVars, plainTextToDocumentHtml } from "@/lib/document-html";

export type PrintTemplateRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  pageSettings?: string | null;
  sortOrder: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function RedaksiClient({ initial }: { initial: PrintTemplateRow[] }) {
  const router = useRouter();
  const editorRef = useRef<DocumentEditorHandle>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextEditorChange = useRef(true);

  const [templates, setTemplates] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [title, setTitle] = useState(initial[0]?.title ?? "");
  const [slug, setSlug] = useState(initial[0]?.slug ?? "");
  const [body, setBody] = useState(() => plainTextToDocumentHtml(initial[0]?.body ?? ""));
  const [pageSettings, setPageSettings] = useState<DocumentPageSettings>(() =>
    parsePageSettings(initial[0]?.pageSettings)
  );
  const [editorKey, setEditorKey] = useState(initial[0]?.id ?? "empty");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [copyFromId, setCopyFromId] = useState("");

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  const selectedSettingsJson = selected ? serializePageSettings(parsePageSettings(selected.pageSettings)) : "";
  const currentSettingsJson = serializePageSettings(pageSettings);

  const dirty = selected
    ? selected.title !== title ||
      selected.slug !== slug ||
      plainTextToDocumentHtml(selected.body) !== body ||
      selectedSettingsJson !== currentSettingsJson
    : false;

  useEffect(() => {
    if (dirty) setSaveStatus((s) => (s === "saving" ? s : "unsaved"));
  }, [dirty]);

  function selectTemplate(row: PrintTemplateRow) {
    if (dirty && !confirm("Ada perubahan yang belum disimpan. Pindah template?")) return;
    setSelectedId(row.id);
    setTitle(row.title);
    setSlug(row.slug);
    setBody(plainTextToDocumentHtml(row.body));
    setPageSettings(parsePageSettings(row.pageSettings));
    setEditorKey(row.id + ":" + String(row.updatedAt ?? ""));
    skipNextEditorChange.current = true;
    setMsg(null);
    setShowPreview(false);
    setSaveStatus("saved");
  }

  function insertPlaceholder(key: string) {
    editorRef.current?.insertPlaceholder(key);
    editorRef.current?.focus();
  }

  const saveCurrent = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selectedId) return;
      const html = editorRef.current?.getHTML() ?? body;
      const settings = editorRef.current?.getPageSettings() ?? pageSettings;
      setSaving(true);
      setSaveStatus("saving");
      if (!opts?.silent) setMsg(null);
      try {
        const res = await fetch(`/api/print-templates/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            slug,
            body: html,
            pageSettings: settings,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Gagal menyimpan");
        setTemplates((prev) => sortPrintTemplates(prev.map((t) => (t.id === selectedId ? { ...t, ...d } : t))));
        setTitle(d.title);
        setSlug(d.slug);
        setBody(d.body);
        setPageSettings(parsePageSettings(d.pageSettings));
        skipNextEditorChange.current = true;
        setSaveStatus("saved");
        if (!opts?.silent) setMsg({ type: "ok", text: "Template disimpan." });
        router.refresh();
      } catch (err: unknown) {
        setSaveStatus("error");
        setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal menyimpan" });
      } finally {
        setSaving(false);
      }
    },
    [selectedId, body, pageSettings, title, slug, router]
  );

  useEffect(() => {
    if (!dirty || !selectedId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void saveCurrent({ silent: true });
    }, 2500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [dirty, body, pageSettings, title, slug, selectedId, saveCurrent]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveCurrent();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveCurrent]);

  async function createTemplate() {
    const titleValue = newTitle.trim();
    if (!titleValue) {
      setMsg({ type: "err", text: "Judul jenis surat wajib diisi." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const source = templates.find((t) => t.id === copyFromId);
      const res = await fetch("/api/print-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleValue,
          body: source?.body ?? "",
          pageSettings: source?.pageSettings ? parsePageSettings(source.pageSettings) : DEFAULT_PAGE_SETTINGS,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menambah");
      setTemplates(sortPrintTemplates([...templates, d]));
      setSelectedId(d.id);
      setTitle(d.title);
      setSlug(d.slug);
      setBody(plainTextToDocumentHtml(d.body));
      setPageSettings(parsePageSettings(d.pageSettings));
      setEditorKey(d.id);
      setAdding(false);
      setNewTitle("");
      setCopyFromId("");
      setSaveStatus("saved");
      setMsg({ type: "ok", text: "Jenis surat ditambahkan." });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal menambah" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrent() {
    if (!selected) return;
    if (!confirm(`Hapus jenis surat "${selected.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/print-templates/${selected.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menghapus");
      const next = templates.filter((t) => t.id !== selected.id);
      setTemplates(next);
      const first = next[0];
      if (first) {
        setSelectedId(first.id);
        setTitle(first.title);
        setSlug(first.slug);
        setBody(plainTextToDocumentHtml(first.body));
        setPageSettings(parsePageSettings(first.pageSettings));
        setEditorKey(first.id);
      } else {
        setSelectedId("");
        setTitle("");
        setSlug("");
        setBody("");
        setPageSettings(DEFAULT_PAGE_SETTINGS);
        setEditorKey("empty");
      }
      setSaveStatus("saved");
      setMsg({ type: "ok", text: "Jenis surat dihapus." });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal menghapus" });
    } finally {
      setSaving(false);
    }
  }

  function downloadBlank() {
    const html = buildPrintableDocumentHtml({
      title: title || "template",
      bodyHtml: editorRef.current?.getHTML() ?? body,
      pageSettings: editorRef.current?.getPageSettings() ?? pageSettings,
      vars: buildSampleVars(),
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "template-surat"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    // Pastikan user melihat versi terisi sebelum/ saat cetak (sama dengan pratinjau)
    if (!showPreview) setShowPreview(true);
    // Tunggu satu frame agar surface pratinjau ter-render, lalu print
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  }

  function onEditorChange(html: string, settings: DocumentPageSettings) {
    if (skipNextEditorChange.current) {
      skipNextEditorChange.current = false;
      // Sinkronkan baseline ke HTML TipTap agar tidak dianggap dirty saat buka dokumen.
      setBody(html);
      setPageSettings(settings);
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedId ? { ...t, body: html, pageSettings: serializePageSettings(settings) } : t))
      );
      return;
    }
    setBody(html);
    setPageSettings(settings);
  }

  const statusLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "unsaved"
          ? "Unsaved Changes"
          : "Gagal menyimpan";

  const previewVars = useMemo(() => buildSampleVars(), []);

  const unrecognizedPlaceholders = useMemo(() => findUnrecognizedPlaceholders(body, slug), [body, slug]);

  const suggestedPlaceholders = useMemo(() => {
    const official = TEMPLATE_OFFICIAL_PLACEHOLDERS[slug];
    if (!official) return PRINT_PLACEHOLDERS;
    const set = new Set(official);
    const primary = PRINT_PLACEHOLDERS.filter((p) => set.has(p.key));
    const rest = PRINT_PLACEHOLDERS.filter((p) => !set.has(p.key));
    return [...primary, ...rest];
  }, [slug]);

  return (
    <div>
      <div className="mb-5 no-print">
        <Link href="/settings" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          ← Pengaturan sekolah
        </Link>
        <h1 className="text-lg font-serif mt-2" style={{ color: "var(--text-primary)" }}>
          Redaksi cetak
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Edit master surat dengan editor dokumen, lalu pratinjau, cetak, atau unduh HTML siap cetak.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="no-print rounded-xl border p-3"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Jenis surat
            </h2>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="min-h-11 touch-manipulation rounded-md border px-3 py-2 text-[11px] font-semibold"
              style={{ borderColor: "var(--accent-border)", color: "var(--accent)", background: "var(--accent-light)" }}
            >
              + Tambah
            </button>
          </div>

          {adding && (
            <div
              className="mb-3 space-y-2 rounded-lg border p-2"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
            >
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Judul jenis surat"
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
              />
              <select
                value={copyFromId}
                onChange={(e) => setCopyFromId(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">Mulai kosong</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    Salin dari: {t.title}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createTemplate()}
                  className="min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  Buat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewTitle("");
                    setCopyFromId("");
                  }}
                  className="min-h-11 flex-1 touch-manipulation rounded-md border px-3 py-2 text-[11px] font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selectTemplate(t)}
                  className="w-full min-h-11 touch-manipulation rounded-lg px-2.5 py-2.5 text-left text-xs transition"
                  style={{
                    background: t.id === selectedId ? "var(--accent-light)" : "transparent",
                    color: t.id === selectedId ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: t.id === selectedId ? 600 : 500,
                  }}
                >
                  {t.title}
                </button>
              </li>
            ))}
            {templates.length === 0 && (
              <li className="px-1 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Belum ada jenis surat. Klik Tambah.
              </li>
            )}
          </ul>
        </aside>

        <section
          className="rounded-xl border p-4 sm:p-5 print:border-0 print:bg-transparent print:p-0"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          {!selected ? (
            <p className="text-sm no-print" style={{ color: "var(--text-muted)" }}>
              Pilih atau buat jenis surat untuk mulai mengedit.
            </p>
          ) : (
            <>
              <div className={showPreview ? "no-print hidden" : "no-print space-y-3"}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Judul
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--bg-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Slug
                    </label>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--bg-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      className="block text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Isi redaksi
                    </label>
                    <span
                      className="text-[10px] font-semibold"
                      style={{
                        color:
                          saveStatus === "saved"
                            ? "var(--success)"
                            : saveStatus === "unsaved"
                              ? "var(--warning)"
                              : saveStatus === "error"
                                ? "var(--danger)"
                                : "var(--text-muted)",
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <DocumentEditor
                    key={editorKey}
                    ref={editorRef}
                    initialHtml={body}
                    initialPageSettings={pageSettings}
                    onChange={onEditorChange}
                    onSaveRequest={() => void saveCurrent()}
                  />
                </div>

                <div>
                  <p
                    className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Sisipkan placeholder
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedPlaceholders.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        title={p.label}
                        onClick={() => insertPlaceholder(p.key)}
                        className="rounded-md border px-2 py-1 text-[10px] font-mono"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-secondary)",
                          background: "var(--bg-primary)",
                          opacity: TEMPLATE_OFFICIAL_PLACEHOLDERS[slug]?.includes(p.key) === false ? 0.65 : 1,
                        }}
                      >
                        {`{{${p.key}}}`}
                      </button>
                    ))}
                  </div>
                  {unrecognizedPlaceholders.length > 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--warning)" }}>
                      Peringatan: token tidak ada di daftar resmi jenis surat ini:{" "}
                      {unrecognizedPlaceholders.map((k) => `{{${k}}}`).join(", ")}. Tidak memblokir simpan — boleh tetap
                      dipakai jika sengaja.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving || !dirty}
                    onClick={() => void saveCurrent()}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {saving ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                      background: "var(--bg-primary)",
                    }}
                  >
                    {showPreview ? "Sembunyikan pratinjau" : "Pratinjau"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    Cetak / Simpan PDF
                  </button>
                  <button
                    type="button"
                    onClick={downloadBlank}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                      background: "var(--bg-primary)",
                    }}
                  >
                    Unduh HTML
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void deleteCurrent()}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-bg)" }}
                  >
                    Hapus
                  </button>
                </div>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Tip cetak: di dialog browser pilih Margins = <strong>None</strong> agar sama dengan halaman editor.
                </p>

                {msg && (
                  <p className="text-xs" style={{ color: msg.type === "ok" ? "var(--success)" : "var(--danger)" }}>
                    {msg.text}
                  </p>
                )}
              </div>

              {/* Saat pratinjau: tampilkan surface yang sama dengan yang akan dicetak */}
              {showPreview && (
                <div className="no-print space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving || !dirty}
                      onClick={() => void saveCurrent()}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--accent)" }}
                    >
                      {saving ? "Menyimpan…" : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPreview(false)}
                      className="rounded-lg border px-3 py-2 text-xs font-semibold"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                        background: "var(--bg-primary)",
                      }}
                    >
                      Kembali ke editor
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                      style={{ background: "var(--accent)" }}
                    >
                      Cetak / Simpan PDF
                    </button>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Pratinjau = layout halaman editor (placeholder terisi data contoh)
                  </p>
                  <DocumentPrintView
                    bodyHtml={body}
                    pageSettings={pageSettings}
                    vars={previewVars}
                    printId="redaksi-preview"
                    variant="screen"
                  />
                </div>
              )}

              {/* Satu surface cetak = sama dengan pratinjau (selalu terisi data contoh di redaksi) */}
              <div className="hidden print:block">
                <DocumentPrintView
                  bodyHtml={body}
                  pageSettings={pageSettings}
                  vars={previewVars}
                  printId="redaksi-print"
                  variant="print-surface"
                />
              </div>
            </>
          )}
        </section>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; margin: 0 !important; }
          /* Paksa margin browser = none; margin surat di @page dokumen */
        }
      `}</style>
    </div>
  );
}
