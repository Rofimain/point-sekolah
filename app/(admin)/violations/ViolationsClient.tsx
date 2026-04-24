"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATS = ["RINGAN","SEDANG","BERAT"] as const;
const CAT_LABELS: Record<string, string> = { RINGAN: "Ringan", SEDANG: "Sedang", BERAT: "Berat" };

function CatBadge({ cat }: { cat: string }) {
  const c: Record<string,string[]> = { RINGAN: ["var(--success-bg)","var(--success)"], SEDANG: ["var(--warning-bg)","var(--warning)"], BERAT: ["var(--danger-bg)","var(--danger)"] };
  const [bg, color] = c[cat] || ["var(--bg-tertiary)","var(--text-muted)"];
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color }}>{CAT_LABELS[cat] || cat}</span>;
}

const empty = { name: "", category: "RINGAN" as typeof CATS[number], points: 5, description: "" };

export default function ViolationsClient({ violations }: { violations: any[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<any>(null); // null = closed, "add" | record = open
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  function openAdd() { setForm({ ...empty }); setModal("add"); }
  function openEdit(v: any) { setForm({ name: v.name, category: v.category, points: v.points, description: v.description || "" }); setModal(v); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    if (modal === "add") {
      await fetch("/api/violations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch(`/api/violations/${modal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setLoading(false); setModal(null); router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus jenis pelanggaran ini?")) return;
    await fetch(`/api/violations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const filtered = violations.filter(v => !filter || v.category === filter);

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Manajemen Jenis Pelanggaran</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Kelola daftar pelanggaran dan poin yang berlaku</p>
        </div>
        <button onClick={openAdd} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>+ Tambah Pelanggaran</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {CATS.map(cat => {
          const count = violations.filter(v => v.category === cat).length;
          const c: Record<string,string[]> = { RINGAN: ["var(--success-bg)","var(--success)"], SEDANG: ["var(--warning-bg)","var(--warning)"], BERAT: ["var(--danger-bg)","var(--danger)"] };
          const [bg, color] = c[cat];
          return (
            <div key={cat} className="rounded-xl border p-4 cursor-pointer transition-opacity" style={{ background: "var(--bg-secondary)", borderColor: filter === cat ? color : "var(--border)", borderWidth: filter === cat ? 2 : 1 }} onClick={() => setFilter(filter === cat ? "" : cat)}>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Pelanggaran {CAT_LABELS[cat]}</div>
              <div className="text-2xl font-serif" style={{ color }}>{count}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead><tr style={{ background: "var(--bg-primary)" }}>
            {["Nama Pelanggaran","Kategori","Poin","Keterangan","Status","Aksi"].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} className="border-t" style={{ borderColor: "var(--border)", opacity: v.active ? 1 : 0.5 }}>
                <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>{v.name}</td>
                <td className="px-4 py-3"><CatBadge cat={v.category} /></td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center w-9 h-5 rounded-full text-xs font-bold" style={{ background: v.points >= 50 ? "var(--danger-bg)" : v.points >= 15 ? "var(--warning-bg)" : "var(--success-bg)", color: v.points >= 50 ? "var(--danger)" : v.points >= 15 ? "var(--warning)" : "var(--success)" }}>{v.points}</span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{v.description || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: v.active ? "var(--success-bg)" : "var(--bg-tertiary)", color: v.active ? "var(--success)" : "var(--text-muted)" }}>{v.active ? "Aktif" : "Nonaktif"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(v)} className="px-2.5 py-1 rounded border text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}>Edit</button>
                    <button onClick={() => handleDelete(v.id)} className="px-2.5 py-1 rounded border text-[11px]" style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setModal(null)}>
          <div className="rounded-xl border p-6 w-full max-w-md mx-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-serif mb-4 pb-3 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>{modal === "add" ? "Tambah Jenis Pelanggaran" : `Edit: ${modal.name}`}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Nama Pelanggaran *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Terlambat masuk sekolah" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Kategori</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Poin</label>
                  <input type="number" value={form.points} onChange={e => setForm({ ...form, points: parseInt(e.target.value) || 0 })} min={1} max={100} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Keterangan (opsional)</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Keterangan tambahan..." className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Batal</button>
              <button onClick={handleSave} disabled={loading || !form.name.trim()} className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
