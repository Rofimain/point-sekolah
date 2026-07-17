"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VIOLATION_SECTIONS,
  getViolationSectionLabel,
  type ViolationSection,
} from "@/lib/violation-sections";

const CATS = ["RINGAN", "SEDANG", "BERAT"] as const;
const CAT_LABELS: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };

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
  name: "",
  section: "KELAKUAN" as ViolationSection | "",
  category: "RINGAN" as (typeof CATS)[number],
  points: 5,
  description: "",
};

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

  function openAdd() {
    setForm({ ...empty });
    setModal("add");
  }
  function openEdit(v: any) {
    setForm({
      name: v.name,
      section: (v.section as ViolationSection) || "",
      category: v.category,
      points: v.points,
      description: v.description || "",
    });
    setModal(v);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    const payload = {
      name: form.name,
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

  const filtered = violations.filter((v) => {
    if (filterCat && v.category !== filterCat) return false;
    if (filterSection && (v.section || "") !== filterSection) return false;
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

      {/* Filter per bagian Pasal 15 */}
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

      {/* Filter kategori bobot */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr style={{ background: "var(--bg-primary)" }}>
                    {["Nama Pelanggaran", "Kategori", "Poin", "Keterangan", "Status", ...(canManage ? ["Aksi"] : [])].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((v) => (
                    <tr
                      key={v.id}
                      className="border-t"
                      style={{ borderColor: "var(--border)", opacity: v.active ? 1 : 0.5 }}
                    >
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {v.name}
                      </td>
                      <td className="px-4 py-3">
                        <CatBadge cat={v.category} />
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        {v.description || "—"}
                      </td>
                      <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
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
                  ))}
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

      {canManage && modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
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
              {modal === "add" ? "Tambah Jenis Pelanggaran" : `Edit: ${modal.name}`}
            </h3>
            <div className="space-y-3">
              <div>
                <label
                  className="block text-xs font-semibold mb-1 uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Nama Pelanggaran *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: [49] Terlambat masuk sekolah"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
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
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
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
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
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
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
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
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
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
                disabled={loading || !form.name.trim()}
                className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-60"
                style={{ background: "var(--accent)" }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
