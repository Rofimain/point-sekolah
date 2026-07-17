"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  VIOLATION_SECTIONS,
  getViolationSectionLabel,
  type ViolationSection,
} from "@/lib/violation-sections";
import { joinViolationName, splitViolationName } from "@/lib/violation-name";

const CATS = ["RINGAN", "SEDANG", "BERAT"] as const;
const CAT_LABELS: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };

/** Lebar kolom seragam antar bagian (table-layout: fixed). */
const COLS = {
  no: "4.5rem",
  name: "auto",
  cat: "6.5rem",
  points: "4.25rem",
  desc: "22%",
  status: "5.5rem",
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
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color }}>
      {CAT_LABELS[cat] || cat}
    </span>
  );
}

const empty = {
  code: "",
  title: "",
  section: "KELAKUAN" as ViolationSection | "",
  category: "RINGAN" as (typeof CATS)[number],
  points: 5,
  description: "",
};

function matchesViolationSearch(v: any, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const { code, title } = splitViolationName(v.name || "");
  const blob = [
    v.name,
    code,
    title,
    String(v.points),
    v.description ?? "",
    getViolationSectionLabel(v.section),
    CAT_LABELS[v.category] ?? v.category,
  ]
    .join(" ")
    .toLowerCase();
  return t.split(/\s+/).filter(Boolean).every((p) => blob.includes(p));
}

export default function ViolationsClient({
  violations,
  canManage,
}: {
  violations: any[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  function openAdd() {
    setForm({ ...empty });
    setModal("add");
  }
  function openEdit(v: any) {
    const { code, title } = splitViolationName(v.name || "");
    setForm({
      code,
      title,
      section: (v.section as ViolationSection) || "",
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
    await fetch(`/api/violations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function applySearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSearchQuery(searchInput);
  }

  const filtered = violations.filter((v) => {
    if (filterCat && v.category !== filterCat) return false;
    if (filterSection && (v.section || "") !== filterSection) return false;
    if (!matchesViolationSearch(v, searchQuery)) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of filtered) {
      const key = v.section || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    const keys = [
      ...VIOLATION_SECTIONS.filter((s) => map.has(s)),
      ...[...map.keys()].filter((k) => !(VIOLATION_SECTIONS as readonly string[]).includes(k)),
    ];
    return keys.map((section) => ({ section, items: map.get(section)! }));
  }, [filtered]);

  const colgroup = (
    <colgroup>
      <col style={{ width: COLS.no }} />
      <col />
      <col style={{ width: COLS.cat }} />
      <col style={{ width: COLS.points }} />
      <col style={{ width: COLS.desc }} />
      <col style={{ width: COLS.status }} />
      {canManage ? <col style={{ width: COLS.actions }} /> : null}
    </colgroup>
  );

  const modalUi =
    canManage && modal && portalReady
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setModal(null)}
          >
            <div
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border px-4 pt-4 pb-sheet-bottom shadow-2xl sm:mx-4 sm:rounded-xl sm:p-6"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
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
                      className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      No
                    </label>
                    <input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="89A"
                      className="w-full px-3 py-2 rounded-lg border text-sm tabular-nums"
                      style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Nama Pelanggaran *
                    </label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Terlambat masuk sekolah"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Bagian Pasal 15
                  </label>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value as ViolationSection | "" })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">— Tidak ditentukan —</option>
                    {VIOLATION_SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {getViolationSectionLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Kategori
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
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
                      className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Poin
                    </label>
                    <input
                      type="number"
                      value={form.points}
                      onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={200}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Keterangan (opsional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Sanksi tambahan, remisi, dll."
                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
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
                  className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-60"
                  style={{ background: "var(--accent)" }}
                >
                  Simpan
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
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
            Manajemen Jenis Pelanggaran
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Pasal 15 — Kelakuan, Kerajinan, dan Kerapihan
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="w-full shrink-0 touch-manipulation rounded-lg px-3 py-2.5 text-xs font-semibold text-white sm:w-auto sm:py-1.5"
            style={{ background: "var(--accent)" }}
          >
            + Tambah Pelanggaran
          </button>
        )}
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {VIOLATION_SECTIONS.map((sec) => {
          const count = violations.filter((v) => v.section === sec).length;
          const active = filterSection === sec;
          return (
            <div
              key={sec}
              className="rounded-xl border p-4 cursor-pointer transition-opacity"
              style={{
                background: "var(--bg-secondary)",
                borderColor: active ? "var(--accent)" : "var(--border)",
                borderWidth: active ? 2 : 1,
              }}
              onClick={() => setFilterSection(active ? "" : sec)}
            >
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                {getViolationSectionLabel(sec)}
              </div>
              <div className="text-2xl font-serif" style={{ color: "var(--accent)" }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CATS.map((cat) => {
          const count = violations.filter((v) => v.category === cat).length;
          const c: Record<string, string[]> = {
            RINGAN: ["var(--success-bg)", "var(--success)"],
            SEDANG: ["var(--warning-bg)", "var(--warning)"],
            BERAT: ["var(--danger-bg)", "var(--danger)"],
          };
          const [, color] = c[cat];
          return (
            <div
              key={cat}
              className="rounded-xl border p-3 cursor-pointer"
              style={{
                background: "var(--bg-secondary)",
                borderColor: filterCat === cat ? color : "var(--border)",
                borderWidth: filterCat === cat ? 2 : 1,
              }}
              onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
            >
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Bobot {CAT_LABELS[cat]}
              </div>
              <div className="text-lg font-serif" style={{ color }}>
                {count}
              </div>
            </div>
          );
        })}
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
          className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg px-4 py-2.5 text-xs font-semibold text-white"
          style={{ background: "var(--accent)" }}
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
        {grouped.map(({ section, items }) => (
          <div
            key={section || "lainnya"}
            className="overflow-hidden rounded-xl border"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-2.5 border-b text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {getViolationSectionLabel(section)} · {items.length} jenis
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[920px]">
                {colgroup}
                <thead>
                  <tr style={{ background: "var(--bg-primary)" }}>
                    {["No", "Nama Pelanggaran", "Kategori", "Poin", "Keterangan", "Status", ...(canManage ? ["Aksi"] : [])].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
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
                      <tr
                        key={v.id}
                        className="border-t"
                        style={{ borderColor: "var(--border)", opacity: v.active ? 1 : 0.5 }}
                      >
                        <td
                          className="px-3 py-3 text-xs font-semibold tabular-nums whitespace-nowrap align-top"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {code || "—"}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium align-top break-words" style={{ color: "var(--text-primary)" }}>
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
                        <td className="px-3 py-3 text-xs align-top break-words" style={{ color: "var(--text-muted)" }}>
                          {v.description || "—"}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              background: v.active ? "var(--success-bg)" : "var(--bg-tertiary)",
                              color: v.active ? "var(--success)" : "var(--text-muted)",
                            }}
                          >
                            {v.active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => openEdit(v)}
                                className="px-2.5 py-1 rounded border text-[11px]"
                                style={{
                                  borderColor: "var(--border)",
                                  color: "var(--text-secondary)",
                                  background: "var(--bg-primary)",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(v.id)}
                                className="px-2.5 py-1 rounded border text-[11px]"
                                style={{
                                  background: "var(--danger-bg)",
                                  color: "var(--danger)",
                                  borderColor: "var(--danger)",
                                }}
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
          </div>
        ))}
        {!grouped.length && (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            Tidak ada pelanggaran untuk filter ini.
          </p>
        )}
      </div>

      {modalUi}
    </div>
  );
}
