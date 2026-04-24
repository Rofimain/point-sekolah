"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getInitials, getRoleLabel } from "@/lib/utils";

const ROLES = ["STUDENT","TEACHER","SUPER_ADMIN"] as const;
const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";
const STAFF_DOMAIN = process.env.NEXT_PUBLIC_STAFF_DOMAIN || "sman1contoh.sch.id";

function RoleBadge({ role }: { role: string }) {
  const c: Record<string,string[]> = { STUDENT: ["var(--accent-light)","var(--accent)"], TEACHER: ["var(--warning-bg)","var(--warning)"], SUPER_ADMIN: ["var(--danger-bg)","var(--danger)"] };
  const [bg, color] = c[role] || ["var(--bg-tertiary)","var(--text-muted)"];
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color }}>{getRoleLabel(role)}</span>;
}

const emptyForm = { name: "", email: "", password: "", role: "STUDENT" as typeof ROLES[number], nisn: "", nip: "", classId: "", active: true };

export default function UsersClient({ users, total, page, perPage, classes, searchParams }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / perPage);
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || "");
  const [error, setError] = useState("");

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    sp.delete("page"); router.push(`${pathname}?${sp.toString()}`);
  }

  function openAdd() { setForm({ ...emptyForm }); setError(""); setModal("add"); }
  function openEdit(u: any) { setForm({ name: u.name, email: u.email, password: "", role: u.role, nisn: u.nisn || "", nip: u.nip || "", classId: u.classId || "", active: u.active }); setError(""); setModal(u); }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setError("Nama dan email wajib diisi"); return; }
    if (modal === "add" && !form.password) { setError("Password wajib diisi untuk user baru"); return; }
    setLoading(true); setError("");
    try {
      const body: any = { name: form.name, email: form.email, role: form.role, nisn: form.nisn || null, nip: form.nip || null, classId: form.classId || null, active: form.active };
      if (form.password) body.password = form.password;
      const url = modal === "add" ? "/api/users" : `/api/users/${modal.id}`;
      const method = modal === "add" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Gagal menyimpan"); }
      setModal(null); router.refresh();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus user "${name}"? Semua catatan pelanggaran juga akan terhapus.`)) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !active }) });
    router.refresh();
  }

  const roleFilter = [{ v: "", l: "Semua Role" }, { v: "STUDENT", l: "Siswa" }, { v: "TEACHER", l: "Guru" }, { v: "SUPER_ADMIN", l: "Super Admin" }];

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Manajemen Pengguna</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>CRUD akun siswa, guru, dan super admin</p>
        </div>
        <button onClick={openAdd} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>+ Tambah Pengguna</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["Siswa", "STUDENT", "var(--accent)"],["Guru", "TEACHER", "var(--warning)"],["Super Admin", "SUPER_ADMIN", "var(--danger)"]].map(([label, role, color]) => (
          <div key={role} className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-2xl font-serif" style={{ color: color as string }}>{users.filter((u: any) => u.role === role).length + (total > 20 ? "+" : "")}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-3 mb-4 flex flex-wrap gap-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate({ search })} placeholder="Cari nama... (Enter)" className="px-3 py-2 rounded-lg border text-xs flex-1 min-w-40" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        <select value={searchParams.role || ""} onChange={e => navigate({ role: e.target.value })} className="px-3 py-2 rounded-lg border text-xs" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          {roleFilter.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr style={{ background: "var(--bg-primary)" }}>
              {["Nama","Email","Role","Kelas / Jabatan","Status","Aksi"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", opacity: u.active ? 1 : 0.6 }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{getInitials(u.name)}</div>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "var(--text-muted)" }}>{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{u.class?.name || u.nip || u.nisn || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: u.active ? "var(--success-bg)" : "var(--bg-tertiary)", color: u.active ? "var(--success)" : "var(--text-muted)" }}>{u.active ? "Aktif" : "Nonaktif"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(u)} className="px-2.5 py-1 rounded border text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}>Edit</button>
                      <button onClick={() => toggleActive(u.id, u.active)} className="px-2.5 py-1 rounded border text-[11px]" style={{ borderColor: "var(--border)", color: u.active ? "var(--warning)" : "var(--success)", background: u.active ? "var(--warning-bg)" : "var(--success-bg)" }}>{u.active ? "Blokir" : "Aktifkan"}</button>
                      <button onClick={() => handleDelete(u.id, u.name)} className="px-2.5 py-1 rounded border text-[11px]" style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Halaman {page} dari {totalPages} · {total} pengguna</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(p)); router.push(`${pathname}?${sp.toString()}`); }} className="w-7 h-7 rounded text-xs" style={{ background: p === page ? "var(--accent)" : "var(--bg-primary)", color: p === page ? "white" : "var(--text-secondary)", border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}` }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setModal(null)}>
          <div className="rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-serif mb-4 pb-3 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>{modal === "add" ? "Tambah Pengguna Baru" : `Edit: ${modal.name}`}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Nama Lengkap *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Email *</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Siswa: @{STUDENT_DOMAIN} · Guru/Admin: @{STAFF_DOMAIN}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Password {modal !== "add" && "(kosongkan jika tidak diubah)"}</label>
                  <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="••••••••" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                  </select>
                </div>
                {form.role === "STUDENT" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>NISN</label>
                      <input value={form.nisn} onChange={e => setForm({ ...form, nisn: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Kelas</label>
                      <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                        <option value="">— Pilih kelas —</option>
                        {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {form.role !== "STUDENT" && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>NIP</label>
                    <input value={form.nip} onChange={e => setForm({ ...form, nip: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </div>
                )}
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="activeCheck" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                  <label htmlFor="activeCheck" className="text-xs" style={{ color: "var(--text-secondary)" }}>Akun aktif</label>
                </div>
              </div>
              {error && <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>⚠ {error}</div>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Batal</button>
              <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
