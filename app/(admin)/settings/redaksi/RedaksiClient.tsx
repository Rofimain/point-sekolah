"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import {
  PRINT_PLACEHOLDERS,
  escapeHtml,
  sortPrintTemplates,
} from "@/lib/print-templates";

export type PrintTemplateRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export default function RedaksiClient({ initial }: { initial: PrintTemplateRow[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [title, setTitle] = useState(initial[0]?.title ?? "");
  const [slug, setSlug] = useState(initial[0]?.slug ?? "");
  const [body, setBody] = useState(initial[0]?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [copyFromId, setCopyFromId] = useState("");

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const dirty = selected
    ? selected.title !== title || selected.slug !== slug || selected.body !== body
    : false;

  function selectTemplate(row: PrintTemplateRow) {
    if (dirty && !confirm("Ada perubahan yang belum disimpan. Pindah template?")) return;
    setSelectedId(row.id);
    setTitle(row.title);
    setSlug(row.slug);
    setBody(row.body);
    setMsg(null);
    setShowPreview(false);
  }

  function insertPlaceholder(key: string) {
    const token = `{{${key}}}`;
    setBody((prev) => (prev ? `${prev}${prev.endsWith("\n") ? "" : "\n"}${token}` : token));
  }

  async function saveCurrent() {
    if (!selectedId) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/print-templates/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menyimpan");
      setTemplates((prev) => sortPrintTemplates(prev.map((t) => (t.id === selectedId ? { ...t, ...d } : t))));
      setTitle(d.title);
      setSlug(d.slug);
      setBody(d.body);
      setMsg({ type: "ok", text: "Template disimpan." });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  }

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
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gagal menambah");
      setTemplates(sortPrintTemplates([...templates, d]));
      setSelectedId(d.id);
      setTitle(d.title);
      setSlug(d.slug);
      setBody(d.body);
      setAdding(false);
      setNewTitle("");
      setCopyFromId("");
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
        setBody(first.body);
      } else {
        setSelectedId("");
        setTitle("");
        setSlug("");
        setBody("");
      }
      setMsg({ type: "ok", text: "Jenis surat dihapus." });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal menghapus" });
    } finally {
      setSaving(false);
    }
  }

  function downloadBlank() {
    const safeTitle = escapeHtml(title || "template");
    const safeBody = escapeHtml(body);
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  body { font-family: 'Courier New', Courier, monospace; max-width: 720px; margin: 2rem auto; line-height: 1.55; white-space: pre-wrap; }
</style>
</head>
<body>${safeBody}</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "template-surat"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          Edit master surat, tambah/hapus jenis dokumen, lalu pratinjau, cetak, atau unduh blanko ber-placeholder.
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
            <div className="mb-3 space-y-2 rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Judul jenis surat"
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
              />
              <select
                value={copyFromId}
                onChange={(e) => setCopyFromId(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
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
          className="rounded-xl border p-4 sm:p-5"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          {!selected ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Pilih atau buat jenis surat untuk mulai mengedit.
            </p>
          ) : (
            <>
              <div className="no-print space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Judul
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Slug
                    </label>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Isi redaksi
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={18}
                    className="w-full rounded-lg border px-3 py-2.5 font-mono text-xs leading-relaxed resize-y"
                    style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Sisipkan placeholder
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRINT_PLACEHOLDERS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        title={p.label}
                        onClick={() => insertPlaceholder(p.key)}
                        className="rounded-md border px-2 py-1 text-[10px] font-mono"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                      >
                        {`{{${p.key}}}`}
                      </button>
                    ))}
                  </div>
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
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
                  >
                    {showPreview ? "Sembunyikan pratinjau" : "Pratinjau"}
                  </button>
                  <PrintButton />
                  <button
                    type="button"
                    onClick={downloadBlank}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
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

                {msg && (
                  <p className="text-xs" style={{ color: msg.type === "ok" ? "var(--success)" : "var(--danger)" }}>
                    {msg.text}
                  </p>
                )}
                {dirty && (
                  <p className="text-[11px]" style={{ color: "var(--warning)" }}>
                    Ada perubahan belum disimpan.
                  </p>
                )}
              </div>

              <article
                className={`mt-5 rounded-xl border bg-white p-5 text-black shadow-sm sm:p-8 print:mt-0 print:border-0 print:shadow-none ${
                  showPreview ? "" : "hidden print:block"
                }`}
                style={{ borderColor: "var(--border)" }}
              >
                <header className="mb-4 border-b border-neutral-300 pb-3 text-center no-print">
                  <h2 className="text-base font-bold">{title}</h2>
                  <p className="text-xs text-neutral-500 mt-1">Pratinjau dengan placeholder (tanpa data contoh)</p>
                </header>
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm leading-relaxed">{body}</pre>
              </article>
            </>
          )}
        </section>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
