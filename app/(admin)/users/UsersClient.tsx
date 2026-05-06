"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { getInitials, getRoleLabel } from "@/lib/utils";

const ROLES = ["STUDENT", "TEACHER", "PIKET", "WALI_KELAS", "SUPER_ADMIN"] as const;
const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";
const STAFF_DOMAIN = process.env.NEXT_PUBLIC_STAFF_DOMAIN || "sman1contoh.sch.id";

function RoleBadge({ role }: { role: string }) {
  const c: Record<string, string[]> = {
    STUDENT: ["var(--accent-light)", "var(--accent)"],
    TEACHER: ["var(--warning-bg)", "var(--warning)"],
    PIKET: ["var(--success-bg)", "var(--success)"],
    WALI_KELAS: ["#e0e7ff", "#4338ca"],
    SUPER_ADMIN: ["var(--danger-bg)", "var(--danger)"],
  };
  const [bg, color] = c[role] || ["var(--bg-tertiary)","var(--text-muted)"];
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: bg, color }}>{getRoleLabel(role)}</span>;
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "STUDENT" as typeof ROLES[number],
  nisn: "",
  nip: "",
  classId: "",
  parentTelegram: "",
  active: true,
};

function kelasAtauJabatan(u: { role: string; class?: { name: string } | null; nisn?: string | null; nip?: string | null }) {
  if (u.role === "STUDENT") return u.class?.name || u.nisn || "—";
  if (u.role === "WALI_KELAS") return u.class?.name || "—";
  return u.nip || "—";
}

export default function UsersClient({ users, total, page, perPage, classes, searchParams }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / perPage);
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || "");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    sp.delete("page"); router.push(`${pathname}?${sp.toString()}`);
  }

  function openAdd() { setForm({ ...emptyForm }); setError(""); setModal("add"); }
  function openEdit(u: any) {
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      nisn: u.nisn || "",
      nip: u.nip || "",
      classId: u.classId || "",
      parentTelegram: u.parentTelegram || "",
      active: u.active,
    });
    setError("");
    setModal(u);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setError("Nama dan email wajib diisi"); return; }
    if (modal === "add" && !form.password) { setError("Password wajib diisi untuk user baru"); return; }
    setLoading(true); setError("");
    try {
      const body: any = {
        name: form.name,
        email: form.email,
        role: form.role,
        nisn: form.nisn || null,
        nip: form.nip || null,
        active: form.active,
      };
      if (form.role === "STUDENT" || form.role === "WALI_KELAS") {
        body.classId = form.classId || null;
      } else {
        body.classId = null;
      }
      if (form.role === "STUDENT") {
        body.parentTelegram = form.parentTelegram.trim() || null;
      }
      if (form.password) body.password = form.password;
      const url = modal === "add" ? "/api/users" : `/api/users/${modal.id}`;
      const method = modal === "add" ? "POST" : "PATCH";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      if (modal === "add" && data.ortuTelegramLink && form.role === "STUDENT") {
        try {
          await navigator.clipboard.writeText(data.ortuTelegramLink);
          toast.success("Tautan Telegram ortu disalin — kirim ke orang tua (buka link → Start).");
        } catch {
          toast.info(`Tautan ortu: ${data.ortuTelegramLink}`);
        }
      }
      setModal(null); router.refresh();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus user "${name}"? Semua catatan pelanggaran juga akan terhapus.`)) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function copyOrtuLink(studentId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/parent-telegram-link`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat tautan");
        return;
      }
      const url = data.url || data.ortuTelegramLink;
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success("Tautan disalin. Ortu buka di Telegram lalu Start — tanpa ketik chat ID.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !active }) });
    router.refresh();
  }

  const selectedUsers = useMemo(() => {
    const m = new Map<string, any>();
    users.forEach((u: any) => m.set(u.id, u));
    return Array.from(selectedIds).map((id) => m.get(id)).filter(Boolean);
  }, [selectedIds, users]);

  const selectedCount = selectedIds.size;
  const allOnPageSelected = users.length > 0 && users.every((u: any) => selectedIds.has(u.id));
  const someOnPageSelected = users.some((u: any) => selectedIds.has(u.id));

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        users.forEach((u: any) => next.delete(u.id));
      } else {
        users.forEach((u: any) => next.add(u.id));
      }
      return next;
    });
  }

  async function bulkSetActive(active: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length < 1) return;
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui status");
      toast.success(`Berhasil: ${data.count ?? ids.length} akun ${active ? "diaktifkan" : "dinonaktifkan"}.`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Gagal memperbarui status");
    } finally {
      setLoading(false);
    }
  }

  const canBulkDeleteStudents = selectedCount > 0 && selectedUsers.every((u: any) => u.role === "STUDENT");

  async function bulkDeleteStudents() {
    if (!canBulkDeleteStudents) {
      toast.error("Bulk delete hanya untuk akun siswa.");
      return;
    }
    const ids = Array.from(selectedIds);
    const confirmText = window.prompt(
      `Anda akan menghapus ${ids.length} akun siswa.\nSemua catatan pelanggaran juga akan terhapus.\n\nKetik HAPUS untuk lanjut:`
    );
    if (confirmText !== "HAPUS") return;
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success(`Berhasil menghapus ${data.count ?? ids.length} akun siswa.`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus");
    } finally {
      setLoading(false);
    }
  }

  const roleFilter = [
    { v: "", l: "Semua Role" },
    { v: "STUDENT", l: "Siswa" },
    { v: "TEACHER", l: "Guru" },
    { v: "PIKET", l: "Piket" },
    { v: "WALI_KELAS", l: "Wali Kelas" },
    { v: "SUPER_ADMIN", l: "Super Admin" },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>Manajemen Pengguna</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>CRUD akun siswa, guru, dan super admin</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {selectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {selectedCount} terpilih
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void bulkSetActive(true)}
                className="px-2.5 py-1 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--success)", color: "var(--success)", background: "var(--success-bg)" }}
              >
                Aktifkan
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void bulkSetActive(false)}
                className="px-2.5 py-1 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--warning)", color: "var(--warning)", background: "var(--warning-bg)" }}
              >
                Nonaktifkan
              </button>
              <button
                type="button"
                disabled={loading || !canBulkDeleteStudents}
                onClick={() => void bulkDeleteStudents()}
                className="px-2.5 py-1 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-bg)" }}
                title={!canBulkDeleteStudents ? "Bulk delete hanya untuk akun siswa" : undefined}
              >
                Hapus siswa
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1 rounded border text-[11px] disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
              >
                Clear
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={openAdd}
            className="w-full shrink-0 touch-manipulation rounded-lg px-3 py-2.5 text-xs font-semibold text-white sm:w-auto sm:py-1.5"
            style={{ background: "var(--accent)" }}
          >
            + Tambah Pengguna
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {[
          ["Siswa", "STUDENT", "var(--accent)"],
          ["Guru", "TEACHER", "var(--warning)"],
          ["Piket", "PIKET", "var(--success)"],
          ["Wali Kelas", "WALI_KELAS", "#4338ca"],
          ["Super Admin", "SUPER_ADMIN", "var(--danger)"],
        ].map(([label, role, color]) => (
          <div key={role} className="rounded-xl border p-3 sm:p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="text-[10px] sm:text-xs mb-1 leading-tight" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-xl font-serif sm:text-2xl" style={{ color: color as string }}>{users.filter((u: any) => u.role === role).length + (total > 20 ? "+" : "")}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border p-3 mb-4 flex flex-wrap gap-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate({ search })} placeholder="Cari nama... (Enter)" className="px-3 py-2 rounded-lg border text-xs flex-1 min-w-40" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        <select value={searchParams.role || ""} onChange={e => navigate({ role: e.target.value })} className="px-3 py-2 rounded-lg border text-xs" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          {roleFilter.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
        <select
          value={searchParams.classId || ""}
          onChange={(e) => navigate({ classId: e.target.value })}
          className="px-3 py-2 rounded-lg border text-xs"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <option value="">Semua Kelas</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.grade} {c.name} {c.major}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={loading || !(searchParams.classId || "").trim()}
          onClick={async () => {
            const classId = (searchParams.classId || "").trim();
            if (!classId) return;
            const classObj = classes.find((c: any) => c.id === classId);
            const label = classObj ? `${classObj.grade} ${classObj.name} ${classObj.major}` : "kelas terpilih";
            const confirmText = window.prompt(
              `Anda akan menghapus SEMUA akun siswa di ${label}.\nSemua catatan pelanggaran mereka juga akan terhapus.\n\nKetik HAPUS untuk lanjut:`
            );
            if (confirmText !== "HAPUS") return;
            setLoading(true);
            try {
              const res = await fetch("/api/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classId }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Gagal menghapus");
              toast.success(`Berhasil menghapus ${data.count ?? 0} akun siswa di ${label}.`);
              setSelectedIds(new Set());
              router.refresh();
            } catch (e: any) {
              toast.error(e?.message || "Gagal menghapus");
            } finally {
              setLoading(false);
            }
          }}
          className="px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-60"
          style={{ borderColor: "var(--danger)", background: "var(--danger-bg)", color: "var(--danger)" }}
          title={!(searchParams.classId || "").trim() ? "Pilih kelas dulu" : undefined}
        >
          Hapus siswa per kelas
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr style={{ background: "var(--bg-primary)" }}>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (!el) return;
                    el.indeterminate = !allOnPageSelected && someOnPageSelected;
                  }}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Pilih semua di halaman"
                />
              </th>
              {["Nama","Email","Role","Kelas / Jabatan","Telegram ortu","Status","Aksi"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", opacity: u.active ? 1 : 0.6 }}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelectOne(u.id)}
                      aria-label={`Pilih ${u.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{getInitials(u.name)}</div>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "var(--text-muted)" }}>{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{kelasAtauJabatan(u)}</td>
                  <td
                    className="px-4 py-3 max-w-[10rem] truncate font-mono text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                    title={u.role === "STUDENT" && u.parentTelegram ? u.parentTelegram : undefined}
                  >
                    {u.role === "STUDENT" ? u.parentTelegram || "—" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: u.active ? "var(--success-bg)" : "var(--bg-tertiary)", color: u.active ? "var(--success)" : "var(--text-muted)" }}>{u.active ? "Aktif" : "Nonaktif"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
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
          <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Halaman {page} dari {totalPages} · {total} pengguna</span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(p)); router.push(`${pathname}?${sp.toString()}`); }} className="w-7 h-7 rounded text-xs" style={{ background: p === page ? "var(--accent)" : "var(--bg-primary)", color: p === page ? "white" : "var(--text-secondary)", border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}` }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border px-4 pt-4 pb-sheet-bottom sm:rounded-xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-serif mb-4 pb-3 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>{modal === "add" ? "Tambah Pengguna Baru" : `Edit: ${modal.name}`}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Telegram orang tua</label>
                    <input
                      value={form.parentTelegram}
                      onChange={e => setForm({ ...form, parentTelegram: e.target.value })}
                      placeholder="Hanya chat ID angka, atau kosong — pakai tautan ortu"
                      className="w-full px-3 py-2 rounded-lg border font-mono text-sm"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Atau pakai tautan resmi (tanpa isi ID): tombol di bawah. Ortu buka link → Start; webhook menyimpan chat ID otomatis.
                    </p>
                    {modal !== "add" && modal?.id && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void copyOrtuLink(modal.id)}
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold"
                        style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
                      >
                        Salin tautan Telegram ortu (disarankan)
                      </button>
                    )}
                    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Isi manual chat ID / @username sering gagal untuk DM — tautan + webhook lebih andal (set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME & webhook di Vercel).
                    </p>
                  </div>
                  </>
                )}
                {(form.role === "STUDENT" || form.role === "WALI_KELAS") && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      {form.role === "WALI_KELAS" ? "Kelas yang diampu (walas)" : "Kelas"}
                    </label>
                    <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option value="">— Pilih kelas —</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
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
