"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { groupByViolationSection, getViolationSectionLabel, type ViolationBagianRow } from "@/lib/violation-sections";
import { joinViolationName, splitViolationName, violationNameSortOrder } from "@/lib/violation-name";
import { lockAppScroll, Z_MODAL_CLASS } from "@/lib/ui-layers";
import { SectionAccordion, useSectionAccordionState } from "@/components/SectionAccordion";

const CATS = ["RINGAN", "SEDANG", "BERAT"] as const;
const CAT_LABELS: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };

/** Lebar kolom seragam antar bagian (table-layout: fixed). */
const COLS = {
  no: "4.5rem",
  name: "auto",
  cat: "6.5rem",
  points: "4.25rem",
  desc: "28%",
  actions: "8.75rem",
} as const;

function CatBadge({ cat }: { cat: string }) {
  const c: Record<string, string[]> = {
    RINGAN: ["var(--success-bg)", "var(--success)"],
    SEDANG: ["var(--warning-bg)", "var(--warning)"],
    BERAT: ["var(--danger-bg)", "var(--danger)"],
  };
  const [bg, color] = c[cat] || ["var(--bg-tertiary)", "var(--text-muted)"];
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: bg, color }}>
      {CAT_LABELS[cat] || cat}
    </span>
  );
}

const empty = {
  code: "",
  title: "",
  section: "" as string,
  category: "RINGAN" as (typeof CATS)[number],
  points: 5,
  description: "",
};

function matchesViolationSearch(v: any, q: string, bagian: ViolationBagianRow[]): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const { code, title } = splitViolationName(v.name || "");
  const blob = [
    v.name,
    code,
    title,
    String(v.points),
    v.description ?? "",
    getViolationSectionLabel(v.section, bagian),
    CAT_LABELS[v.category] ?? v.category,
  ]
    .join(" ")
    .toLowerCase();
  return t
    .split(/\s+/)
    .filter(Boolean)
    .every((p) => blob.includes(p));
}

export default function ViolationsClient({
  violations,
  bagian,
  canManage,
}: {
  violations: any[];
  bagian: ViolationBagianRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<any>(null);
  const [bagianModal, setBagianModal] = useState(false);
  const [bagianLabel, setBagianLabel] = useState("");
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!modal && !bagianModal) return;
    return lockAppScroll();
  }, [modal, bagianModal]);

  function openAdd() {
    setForm({ ...empty, section: bagian[0]?.id ?? "" });
    setModal("add");
  }
  function openEdit(v: any) {
    const { code, title } = splitViolationName(v.name || "");
    setForm({
      code,
      title,
      section: (v.section as string) || "",
      category: v.category,
      points: v.points,
      description: v.description || "",
    });
    setModal(v);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setLoading(true);
    const payload = {
      name: joinViolationName(form.code, form.title),
      section: form.section || null,
      category: form.category,
      points: form.points,
      description: form.description,
    };
    if (modal === "add") {
      await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/violations/${modal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setLoading(false);
    setModal(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus jenis pelanggaran ini?")) return;
    const res = await fetch(`/api/violations/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(d.error || "Gagal menghapus");
      return;
    }
    if (d.deactivated) {
      alert("Jenis ini masih dipakai di riwayat catatan, jadi dinonaktifkan (tidak tampil di daftar aktif).");
    }
    router.refresh();
  }

  async function handleAddBagian() {
    const label = bagianLabel.trim();
    if (label.length < 2) return;
    setLoading(true);
    const res = await fetch("/api/violation-bagian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      alert(d.error || "Gagal menambah bagian");
      return;
    }
    setBagianLabel("");
    setBagianModal(false);
    router.refresh();
  }

  async function handleDeleteBagian(id: string, label: string) {
    if (!confirm(`Hapus bagian "${label}"?`)) return;
    const res = await fetch(`/api/violation-bagian/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(d.error || "Gagal menghapus bagian");
      return;
    }
    router.refresh();
  }

  function applySearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSearchQuery(searchInput);
  }

  const bagianUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bagian) map.set(b.id, 0);
    for (const v of violations) {
      const s = v.section || "";
      if (s) map.set(s, (map.get(s) || 0) + 1);
    }
    return map;
  }, [bagian, violations]);

  const filtered = violations.filter((v) => matchesViolationSearch(v, searchQuery, bagian));

  const grouped = useMemo(() => {
    return groupByViolationSection(filtered, bagian).map(({ section, items }) => ({
      section,
      items: [...items].sort((a, b) => {
        const byCode = violationNameSortOrder(a.name || "") - violationNameSortOrder(b.name || "");
        if (byCode !== 0) return byCode;
        return (
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.points - b.points || String(a.name).localeCompare(String(b.name))
        );
      }),
    }));
  }, [filtered, bagian]);

  const sectionKeys = useMemo(() => grouped.map((g) => g.section || "lainnya"), [grouped]);
  const { isOpen, toggle } = useSectionAccordionState(sectionKeys, Boolean(searchQuery.trim()));

  const colgroup = (
    <colgroup>
      <col style={{ width: COLS.no }} />
      <col />
      <col style={{ width: COLS.cat }} />
      <col style={{ width: COLS.points }} />
      <col style={{ width: COLS.desc }} />
      {canManage ? <col style={{ width: COLS.actions }} /> : null}
    </colgroup>
  );

  const modalUi =
    canManage && modal && portalReady
      ? createPortal(
          <div
            className={`modal-overlay ${Z_MODAL_CLASS} flex items-end justify-center p-0 sm:items-center sm:p-4`}
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setModal(null)}
          >
            <div
              className="modal-surface max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] rounded-b-none px-4 pt-4 pb-sheet-bottom sm:mx-4 sm:rounded-[1.25rem] sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="text-sm font-serif mb-4 pb-3 border-b"
                style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
              >
                {modal === "add"
                  ? "Tambah Jenis Pelanggaran"
                  : `Edit: ${joinViolationName(form.code, form.title) || modal.name}`}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                  <div>
                    <label
                      className="label"
                    >
                      No
                    </label>
                    <input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="89A"
                      className="input tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      className="label"
                    >
                      Nama Pelanggaran *
                    </label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Terlambat masuk sekolah"
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="label"
                  >
                    Bagian
                  </label>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    className="select"
                  >
                    <option value="">— Tidak ditentukan —</option>
                    {bagian.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      className="label"
                    >
                      Kategori
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                      className="select"
                    >
                      {CATS.map((c) => (
                        <option key={c} value={c}>
                          {CAT_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="label"
                    >
                      Poin
                    </label>
                    <input
                      type="number"
                      value={form.points}
                      onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={200}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="label"
                  >
                    Keterangan (opsional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Sanksi tambahan, remisi, dll."
                    className="textarea resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !form.title.trim()}
                  className="btn btn-primary text-sm"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const bagianModalUi =
    canManage && bagianModal && portalReady
      ? createPortal(
          <div
            className={`modal-overlay ${Z_MODAL_CLASS} flex items-end justify-center p-0 sm:items-center sm:p-4`}
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setBagianModal(false)}
          >
            <div
              className="modal-surface max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] rounded-b-none px-4 pt-4 pb-sheet-bottom sm:mx-4 sm:rounded-[1.25rem] sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="text-sm font-serif mb-4 pb-3 border-b"
                style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
              >
                Kelola Bagian
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    className="label"
                  >
                    Nama bagian baru
                  </label>
                  <input
                    value={bagianLabel}
                    onChange={(e) => setBagianLabel(e.target.value)}
                    placeholder="Contoh: Kebersihan"
                    className="input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBagian();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddBagian}
                  disabled={loading || bagianLabel.trim().length < 2}
                  className="btn btn-primary btn-sm w-full"
                >
                  Tambah bagian
                </button>
              </div>
              {bagian.length > 0 ? (
                <ul className="mt-4 divide-y rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  {bagian.map((b) => {
                    const usage = bagianUsage.get(b.id) || 0;
                    return (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                        style={{ background: "var(--bg-primary)" }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {b.label}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {usage} jenis pelanggaran
                          </div>
                        </div>
                        {usage === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteBagian(b.id, b.label)}
                            className="btn btn-danger shrink-0 text-[11px] btn-sm"
                          >
                            Hapus
                          </button>
                        ) : (
                          <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Dipakai
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Belum ada bagian.
                </p>
              )}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setBagianModal(false)}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">
            Manajemen Jenis Pelanggaran
          </h1>
        </div>
        {canManage && (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setBagianLabel("");
                setBagianModal(true);
              }}
              className="btn btn-secondary w-full touch-manipulation text-xs sm:w-auto sm:py-1.5 btn-sm"
            >
              + Tambah bagian
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="btn btn-primary w-full shrink-0 touch-manipulation text-xs sm:w-auto sm:py-1.5 btn-sm"
            >
              + Tambah Pelanggaran
            </button>
          </div>
        )}
      </div>

      <form onSubmit={applySearch} className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            if (!e.target.value.trim()) setSearchQuery("");
          }}
          placeholder="Cari no, nama, poin, keterangan…"
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0 text-xs btn-sm"
        >
          Cari
        </button>
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
            }}
            className="shrink-0 rounded-lg border px-3 py-2.5 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Reset
          </button>
        ) : null}
      </form>

      <div className="space-y-4">
        {grouped.map(({ section, items }) => {
          const key = section || "lainnya";
          return (
            <SectionAccordion
              key={key}
              title={getViolationSectionLabel(section, bagian)}
              count={items.length}
              open={isOpen(key)}
              onToggle={() => toggle(key)}
            >
              <ul className="divide-y md:hidden" style={{ borderColor: "var(--border)" }}>
                {items.map((v) => {
                  const { code, title } = splitViolationName(v.name || "");
                  return (
                    <li key={v.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="text-[11px] font-semibold tabular-nums"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {code || "—"}
                            </span>
                            <CatBadge cat={v.category} />
                          </div>
                          <div
                            className="mt-1 text-sm font-medium leading-snug break-words"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {title || v.name}
                          </div>
                          {v.description ? (
                            <div
                              className="mt-1 text-[11px] leading-snug break-words"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {v.description}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center justify-center min-w-9 h-6 px-1.5 rounded-full text-xs font-bold"
                          style={{
                            background:
                              v.points >= 51
                                ? "var(--danger-bg)"
                                : v.points >= 16
                                  ? "var(--warning-bg)"
                                  : "var(--success-bg)",
                            color:
                              v.points >= 51 ? "var(--danger)" : v.points >= 16 ? "var(--warning)" : "var(--success)",
                          }}
                        >
                          {v.points}
                        </span>
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => openEdit(v)}
                            className="btn btn-secondary touch-manipulation text-[11px] btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="btn btn-danger touch-manipulation text-[11px] btn-sm"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="table-elegant w-full table-fixed min-w-[920px]">
                  {colgroup}
                  <thead>
                    <tr>
                      {["No", "Nama Pelanggaran", "Kategori", "Poin", "Keterangan", ...(canManage ? ["Aksi"] : [])].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v) => {
                      const { code, title } = splitViolationName(v.name || "");
                      return (
                        <tr key={v.id}>
                          <td
                            className="px-3 py-3 text-xs font-semibold tabular-nums whitespace-nowrap align-top"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {code || "—"}
                          </td>
                          <td
                            className="px-3 py-3 text-xs font-medium align-top break-words"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {title || v.name}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <CatBadge cat={v.category} />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span
                              className="inline-flex items-center justify-center min-w-9 h-5 px-1.5 rounded-full text-xs font-bold"
                              style={{
                                background:
                                  v.points >= 51
                                    ? "var(--danger-bg)"
                                    : v.points >= 16
                                      ? "var(--warning-bg)"
                                      : "var(--success-bg)",
                                color:
                                  v.points >= 51
                                    ? "var(--danger)"
                                    : v.points >= 16
                                      ? "var(--warning)"
                                      : "var(--success)",
                              }}
                            >
                              {v.points}
                            </span>
                          </td>
                          <td
                            className="px-3 py-3 text-xs align-top break-words"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {v.description || "—"}
                          </td>
                          {canManage && (
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => openEdit(v)}
                                  className="btn btn-secondary touch-manipulation text-[11px] btn-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(v.id)}
                                  className="btn btn-danger touch-manipulation text-[11px] btn-sm"
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionAccordion>
          );
        })}
        {!grouped.length && (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            Tidak ada pelanggaran untuk filter ini.
          </p>
        )}
      </div>

      {modalUi}
      {bagianModalUi}
    </div>
  );
}
