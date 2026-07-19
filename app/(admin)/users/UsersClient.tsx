"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import { getRoleLabel } from "@/lib/utils";
import { canDeleteUser, canModifyUser, isSuperAdmin } from "@/lib/staff-roles";
import {
  compressImageToDataUrl,
  COMPRESS_MAX_DIM_AVATAR,
  COMPRESS_TARGET_BYTES_AVATAR,
  isProbablyImageFile,
} from "@/lib/compress-image-client";
import UserAvatar from "@/components/ui/UserAvatar";
import { lockAppScroll, Z_MODAL_CLASS } from "@/lib/ui-layers";
import { USER_STATUS_LABEL } from "@/lib/user-status";
import { formatClassLabel } from "@/lib/class-label";

const ROLES = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";
const STAFF_DOMAIN = process.env.NEXT_PUBLIC_STAFF_DOMAIN || "sman1contoh.sch.id";

function RoleBadge({ role }: { role: string }) {
  const c: Record<string, string[]> = {
    STUDENT: ["var(--accent-light)", "var(--accent)"],
    TEACHER: ["var(--warning-bg)", "var(--warning)"],
    ADMIN: ["var(--success-bg)", "var(--success)"],
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
  active: true,
};

function telegramOrtuTableCell(u: {
  role: string;
  parentTelegram?: string | null;
  ortuTelegramStatus?: "connected" | "pending" | "none" | null;
}) {
  if (u.role !== "STUDENT") return "—";
  if (u.ortuTelegramStatus === "connected" && u.parentTelegram?.trim()) {
    const id = u.parentTelegram.trim();
    return id.length > 8 ? `Terhubung …${id.slice(-6)}` : "Terhubung";
  }
  if (u.ortuTelegramStatus === "pending") return "Menunggu ortu";
  return "—";
}

function statusBadgeLabel(u: { status?: string; active?: boolean }) {
  if (u.status && u.status in USER_STATUS_LABEL) {
    return USER_STATUS_LABEL[u.status as keyof typeof USER_STATUS_LABEL];
  }
  return u.active ? "Aktif" : "Nonaktif";
}

function statusBadgeActive(u: { status?: string; active?: boolean }) {
  return u.status ? u.status === "ACTIVE" : Boolean(u.active);
}

function isSchoolEmailDomain(email: string) {
  const host = email.split("@")[1]?.toLowerCase() || "";
  return host === STUDENT_DOMAIN.toLowerCase() || host === STAFF_DOMAIN.toLowerCase();
}

function GoogleLinkBadge({ u }: { u: { googleSub?: string | null; email?: string; authProvider?: string } }) {
  const linked = Boolean(u.googleSub);
  const domainOk = isSchoolEmailDomain(u.email || "");
  if (linked) {
    return (
      <span
        className="px-2 py-0.5 rounded text-[10px] font-semibold"
        style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        title="Akun Google terhubung"
      >
        Google ✓
      </span>
    );
  }
  if (!domainOk) {
    return (
      <span
        className="px-2 py-0.5 rounded text-[10px] font-semibold"
        style={{ background: "var(--warning-bg)", color: "var(--warning)" }}
        title={`Email di luar @${STAFF_DOMAIN} — Google login tidak bisa`}
      >
        Domain ✗
      </span>
    );
  }
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
      title="Belum link Google — user login Google sekali untuk menghubungkan"
    >
      Belum link
    </span>
  );
}

function kelasAtauNip(u: { role: string; class?: { name: string } | null; nisn?: string | null; nip?: string | null }) {
  if (u.role === "STUDENT") return u.class?.name || "—";
  return u.nip?.trim() || "—";
}


export default function UsersClient({
  users,
  total,
  page,
  perPage,
  classes,
  searchParams,
  superAdminTotal,
  activeSuperAdminCount,
  viewerRole,
  viewerId,
}: any) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / perPage);
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [exportingTelLinks, setExportingTelLinks] = useState(false);
  const [search, setSearch] = useState(searchParams.search || "");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  /** null = tidak diubah; string = data URL baru; "" = hapus foto */
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!modal) return;
    return lockAppScroll();
  }, [modal]);

  useEffect(() => {
    setSearch(searchParams.search || "");
  }, [searchParams.search]);

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); else sp.delete(k); });
    sp.delete("page"); router.push(`${pathname}?${sp.toString()}`);
  }

  function openAdd() {
    setForm({ ...emptyForm });
    setPhotoDraft(null);
    setError("");
    setModal("add");
  }
  function openEdit(u: any) {
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      nisn: u.nisn || "",
      nip: u.nip || "",
      classId: u.classId || "",
      active: u.active,
    });
    setPhotoDraft(null);
    setError("");
    setModal(u);
  }

  async function onPhotoFile(file: File | null) {
    if (!file) return;
    if (!isProbablyImageFile(file)) {
      toast.error("Gunakan file gambar (JPG, PNG, HEIC, WebP, dll.).");
      return;
    }
    setPhotoBusy(true);
    try {
      const { dataUrl, meta } = await compressImageToDataUrl(file, {
        maxBytes: COMPRESS_TARGET_BYTES_AVATAR,
        maxDimension: COMPRESS_MAX_DIM_AVATAR,
        minShortSide: 64,
      });
      setPhotoDraft(dataUrl);
      toast.success(`Foto siap (${Math.round(meta.outputBytes / 1024)} KB).`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses foto");
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
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
      if (form.role === "STUDENT") {
        body.classId = form.classId || null;
      } else {
        body.classId = null;
      }
      if (form.password) body.password = form.password;
      if (modal === "add") {
        if (photoDraft) body.photoData = photoDraft;
      } else if (photoDraft !== null) {
        body.photoData = photoDraft === "" ? null : photoDraft;
      }
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
      toast.success(modal === "add" ? "Pengguna ditambahkan." : "Data pengguna disimpan.");
      setModal(null); router.refresh();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: string, name: string) {
    const confirmText = window.prompt(
      `Hapus PERMANEN akun "${name}"?\n\nAkun, foto, catatan pelanggaran, dan remisi terkait akan hilang dan tidak bisa dikembalikan.\n\nKetik HAPUS PERMANEN untuk lanjut:`
    );
    if (confirmText !== "HAPUS PERMANEN") return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Gagal menghapus");
      return;
    }
    toast.success(`Akun "${name}" dihapus permanen.`);
    router.refresh();
  }

  async function downloadTelegramLinksExcel() {
    setExportingTelLinks(true);
    try {
      const sp = new URLSearchParams();
      if ((searchParams.search || "").trim()) sp.set("search", searchParams.search!.trim());
      if ((searchParams.classId || "").trim()) sp.set("classId", searchParams.classId!.trim());
      if ((searchParams.role || "").trim()) sp.set("role", searchParams.role!.trim());
      const res = await fetch(`/api/users/export-telegram-links?${sp.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Gagal mengunduh");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="([^"]+)"/);
      const filename = m?.[1] || "tautan-telegram-ortu.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel tautan Telegram ortu diunduh.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh");
    } finally {
      setExportingTelLinks(false);
    }
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
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Gagal mengubah status");
      return;
    }
    router.refresh();
  }

  async function unlinkGoogle(id: string, name: string) {
    if (
      !confirm(
        `Putus tautan Google untuk "${name}"?\nUser bisa login password seperti biasa.\nUntuk relink: user login Google lagi (email harus sama).`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}/google-link`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal unlink Google");
      toast.success("Tautan Google diputus.");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Gagal unlink Google");
    } finally {
      setLoading(false);
    }
  }

  async function runGoogleReadinessAudit() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if ((searchParams.role || "").trim()) sp.set("role", searchParams.role!.trim());
      const res = await fetch(`/api/users/google-readiness?${sp.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal audit");
      const s = data.summary || {};
      toast.message("Audit kesiapan Google", {
        description: `Total ${s.total ?? 0} · Linked ${s.linked ?? 0} · Siap belum link ${s.domainOkUnlinked ?? 0} · Domain salah ${s.domainBad ?? 0} · Non-ACTIVE ${s.inactiveBlocked ?? 0}`,
        duration: 10_000,
      });
    } catch (e: any) {
      toast.error(e?.message || "Gagal audit Google");
    } finally {
      setLoading(false);
    }
  }

  const selectedUsers = useMemo(() => {
    const m = new Map<string, any>();
    users.forEach((u: any) => m.set(u.id, u));
    return Array.from(selectedIds).map((id) => m.get(id)).filter(Boolean);
  }, [selectedIds, users]);

  const selectedCount = selectedIds.size;
  const selectableUsers = users.filter((u: any) => canModifyUser(viewerRole, u.role));
  const allOnPageSelected =
    selectableUsers.length > 0 && selectableUsers.every((u: any) => selectedIds.has(u.id));
  const someOnPageSelected = selectableUsers.some((u: any) => selectedIds.has(u.id));

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
        selectableUsers.forEach((u: any) => next.delete(u.id));
      } else {
        selectableUsers.forEach((u: any) => next.add(u.id));
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

  async function bulkCopyParentTelegramLinks() {
    const ids = Array.from(selectedIds);
    if (ids.length < 1) return;
    setLoading(true);
    try {
      const res = await fetch("/api/users/parent-telegram-links-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membuat tautan");
      const links = (data.links || []) as { name: string; nisn: string; className: string; url: string }[];
      if (links.length < 1) {
        toast.error("Tidak ada akun siswa di pilihan. Tautan hanya untuk role Siswa.");
        return;
      }
      const header = "nama\tnisn\tkelas\ttautan_telegram_ortu";
      const lines = links.map(
        (l) => `${l.name}\t${l.nisn || "—"}\t${l.className || "—"}\t${l.url}`
      );
      const text = [header, ...lines].join("\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        toast.error("Tidak bisa mengakses clipboard. Coba browser lain atau HTTPS.");
        return;
      }
      const gen = data.generatedCount ?? links.length;
      const skip = data.skippedCount ?? 0;
      let msg = `Disalin ${gen} tautan (tab — tempel ke Excel/Sheets).`;
      if (skip > 0) msg += ` ${skip} baris bukan siswa / tidak ditemukan.`;
      toast.success(msg);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setLoading(false);
    }
  }

  async function bulkDeleteStudents() {
    if (!canBulkDeleteStudents) {
      toast.error("Bulk delete hanya untuk akun siswa.");
      return;
    }
    const ids = Array.from(selectedIds);
    const confirmText = window.prompt(
      `Hapus PERMANEN ${ids.length} akun siswa?\n\nAkun + catatan pelanggaran terkait hilang permanen.\n\nKetik HAPUS PERMANEN untuk lanjut:`
    );
    if (confirmText !== "HAPUS PERMANEN") return;
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      toast.success(`Berhasil menghapus permanen ${data.count ?? ids.length} akun siswa.`);
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
    { v: "ADMIN", l: "Admin / Bidang Pertahanan Sekolah" },
    { v: "SUPER_ADMIN", l: "Super Admin" },
  ];

  const roleParam = (searchParams.role || "").trim();
  const showClassFilter = roleParam === "STUDENT";
  const metaColumnLabel =
    roleParam === "STUDENT" ? "Kelas" : roleParam === "TEACHER" || roleParam === "ADMIN" || roleParam === "SUPER_ADMIN" ? "NIP" : "Kelas / NIP";

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
                className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--success)", color: "var(--success)", background: "var(--success-bg)" }}
              >
                Aktifkan
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void bulkSetActive(false)}
                className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--warning)", color: "var(--warning)", background: "var(--warning-bg)" }}
              >
                Nonaktifkan
              </button>
              <button
                type="button"
                disabled={loading || !canBulkDeleteStudents}
                onClick={() => void bulkDeleteStudents()}
                className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-bg)" }}
                title={!canBulkDeleteStudents ? "Bulk delete hanya untuk akun siswa" : undefined}
              >
                Hapus siswa
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void bulkCopyParentTelegramLinks()}
                className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] font-medium disabled:opacity-60"
                style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
                title="Buat token baru & salin nama + tautan (hanya baris siswa). Tempel ke Excel."
              >
                Salin tautan ortu
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
              >
                Clear
              </button>
            </div>
          ) : null}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runGoogleReadinessAudit()}
            className="w-full shrink-0 touch-manipulation rounded-lg border px-3 py-2.5 text-xs font-semibold disabled:opacity-60 sm:w-auto sm:py-1.5"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
            title="Ringkasan kesiapan Google login (tanpa ubah data)"
          >
            Audit Google
          </button>
          <button
            type="button"
            disabled={exportingTelLinks}
            onClick={() => void downloadTelegramLinksExcel()}
            className="w-full shrink-0 touch-manipulation rounded-lg border px-3 py-2.5 text-xs font-semibold disabled:opacity-60 sm:w-auto sm:py-1.5"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
            title="Semua siswa yang cocok filter pencarian & kelas (bukan hanya halaman ini)"
          >
            {exportingTelLinks ? "Mengunduh…" : "Unduh Excel tautan ortu"}
          </button>
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
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          ["Siswa", "STUDENT", "var(--accent)"],
          ["Guru", "TEACHER", "var(--warning)"],
          ["Admin", "ADMIN", "var(--success)"],
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
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate({ search: search.trim() })} placeholder="Cari nama..." className="px-3 py-2 rounded-lg border text-xs flex-1 min-w-40" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        <button type="button" onClick={() => navigate({ search: search.trim() })} className="btn-primary px-4 py-2 text-xs">
          Cari
        </button>
        <select
          value={searchParams.role || ""}
          onChange={(e) => {
            const role = e.target.value;
            // Filter kelas hanya relevan untuk siswa
            navigate(role === "STUDENT" ? { role } : { role, classId: "" });
          }}
          className="px-3 py-2 rounded-lg border text-xs"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {roleFilter.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
        {showClassFilter ? (
          <>
            <select
              value={searchParams.classId || ""}
              onChange={(e) => navigate({ classId: e.target.value })}
              className="px-3 py-2 rounded-lg border text-xs"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <option value="">Semua Kelas</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {formatClassLabel(c)}
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
                const label = classObj ? formatClassLabel(classObj) : "kelas terpilih";
                const confirmText = window.prompt(
                  `Hapus PERMANEN SEMUA akun siswa di ${label}?\n\nAkun + catatan pelanggaran terkait hilang permanen.\n\nKetik HAPUS PERMANEN untuk lanjut:`
                );
                if (confirmText !== "HAPUS PERMANEN") return;
                setLoading(true);
                try {
                  const res = await fetch("/api/users", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ classId }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error || "Gagal menghapus");
                  toast.success(`Berhasil menghapus permanen ${data.count ?? 0} akun siswa di ${label}.`);
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
          </>
        ) : null}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        {users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Tidak ada pengguna
          </div>
        ) : (
          <>
            {/* Mobile: select-all bar + cards */}
            <div className="flex items-center gap-2 border-b px-4 py-2 md:hidden" style={{ borderColor: "var(--border)" }}>
              <label className="inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (!el) return;
                    el.indeterminate = !allOnPageSelected && someOnPageSelected;
                  }}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Pilih semua di halaman"
                  className="h-4 w-4"
                />
              </label>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Pilih semua di halaman
              </span>
            </div>
            <ul className="divide-y md:hidden" style={{ borderColor: "var(--border)" }}>
              {users.map((u: any) => (
                <li
                  key={u.id}
                  className="space-y-2.5 px-4 py-3"
                  style={{ opacity: u.active ? 1 : 0.6 }}
                >
                  <div className="flex items-start gap-3">
                    <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        disabled={!canModifyUser(viewerRole, u.role)}
                        onChange={() => toggleSelectOne(u.id)}
                        aria-label={`Pilih ${u.name}`}
                        className="h-4 w-4"
                      />
                    </label>
                    <UserAvatar
                      name={u.name}
                      userId={u.id}
                      photoPresent={!!u.photoPresent}
                      cacheKey={u.updatedAt ? String(u.updatedAt) : undefined}
                      size="md"
                      rounded="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold break-words" style={{ color: "var(--text-primary)" }}>
                          {u.name}
                        </span>
                        <RoleBadge role={u.role} />
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            background: statusBadgeActive(u) ? "var(--success-bg)" : "var(--bg-tertiary)",
                            color: statusBadgeActive(u) ? "var(--success)" : "var(--text-muted)",
                          }}
                        >
                          {statusBadgeLabel(u)}
                        </span>
                        <GoogleLinkBadge u={u} />
                      </div>
                      <div className="mt-0.5 break-all text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {u.email}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {metaColumnLabel}: {kelasAtauNip(u)}
                      </div>
                      {u.role === "STUDENT" ? (
                        <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Ortu: {telegramOrtuTableCell(u)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      disabled={
                        !canModifyUser(viewerRole, u.role) &&
                        !(viewerRole === "ADMIN" && u.id === viewerId)
                      }
                      onClick={() => openEdit(u)}
                      className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={
                        !canModifyUser(viewerRole, u.role) ||
                        (u.role === "SUPER_ADMIN" && u.active && activeSuperAdminCount <= 1)
                      }
                      onClick={() => toggleActive(u.id, u.active)}
                      className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                      style={{
                        borderColor: "var(--border)",
                        color: u.active ? "var(--warning)" : "var(--success)",
                        background: u.active ? "var(--warning-bg)" : "var(--success-bg)",
                      }}
                    >
                      {u.active ? "Blokir" : "Aktifkan"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        loading ||
                        !u.googleSub ||
                        (!canModifyUser(viewerRole, u.role) && !(viewerRole === "ADMIN" && u.id === viewerId))
                      }
                      onClick={() => void unlinkGoogle(u.id, u.name)}
                      className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                      title={u.googleSub ? "Putus tautan Google (relink = login Google lagi)" : "Belum terhubung Google"}
                    >
                      Unlink Google
                    </button>
                    <button
                      type="button"
                      disabled={
                        !canDeleteUser(viewerRole, u.role) ||
                        (u.role === "SUPER_ADMIN" && superAdminTotal <= 1)
                      }
                      onClick={() => handleDelete(u.id, u.name)}
                      className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                      style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr style={{ background: "var(--bg-primary)" }}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      <label className="inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center">
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
                      </label>
                    </th>
                    {["Nama", "Email", "Role", metaColumnLabel, "Ortu (Telegram)", "Status", "Google", "Aksi"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", opacity: u.active ? 1 : 0.6 }}>
                      <td className="px-4 py-3">
                        <label className="inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(u.id)}
                            disabled={!canModifyUser(viewerRole, u.role)}
                            onChange={() => toggleSelectOne(u.id)}
                            aria-label={`Pilih ${u.name}`}
                          />
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={u.name}
                            userId={u.id}
                            photoPresent={!!u.photoPresent}
                            cacheKey={u.updatedAt ? String(u.updatedAt) : undefined}
                            size="sm"
                          />
                          <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                            {u.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {kelasAtauNip(u)}
                      </td>
                      <td
                        className="px-4 py-3 max-w-[11rem] truncate text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                        title={
                          u.role === "STUDENT" && u.parentTelegram?.trim()
                            ? `Chat ID: ${u.parentTelegram}`
                            : u.role === "STUDENT" && u.ortuTelegramStatus === "pending"
                              ? "Belum terhubung — kirim tautan ortu dari tombol Salin tautan"
                              : undefined
                        }
                      >
                        {telegramOrtuTableCell(u)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            background: statusBadgeActive(u) ? "var(--success-bg)" : "var(--bg-tertiary)",
                            color: statusBadgeActive(u) ? "var(--success)" : "var(--text-muted)",
                          }}
                        >
                          {statusBadgeLabel(u)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <GoogleLinkBadge u={u} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            disabled={
                              !canModifyUser(viewerRole, u.role) &&
                              !(viewerRole === "ADMIN" && u.id === viewerId)
                            }
                            onClick={() => openEdit(u)}
                            className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canModifyUser(viewerRole, u.role) ||
                              (u.role === "SUPER_ADMIN" && u.active && activeSuperAdminCount <= 1)
                            }
                            onClick={() => toggleActive(u.id, u.active)}
                            className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                            style={{
                              borderColor: "var(--border)",
                              color: u.active ? "var(--warning)" : "var(--success)",
                              background: u.active ? "var(--warning-bg)" : "var(--success-bg)",
                            }}
                            title={
                              u.role === "SUPER_ADMIN" && u.active && activeSuperAdminCount <= 1
                                ? "Aktifkan Super Admin lain dulu — harus ada minimal 1 Super Admin aktif"
                                : undefined
                            }
                          >
                            {u.active ? "Blokir" : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              loading ||
                              !u.googleSub ||
                              (!canModifyUser(viewerRole, u.role) && !(viewerRole === "ADMIN" && u.id === viewerId))
                            }
                            onClick={() => void unlinkGoogle(u.id, u.name)}
                            className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                            title={u.googleSub ? "Putus tautan Google (relink = login Google lagi)" : "Belum terhubung Google"}
                          >
                            Unlink
                          </button>
                          <button
                            type="button"
                            disabled={
                              !canDeleteUser(viewerRole, u.role) ||
                              (u.role === "SUPER_ADMIN" && superAdminTotal <= 1)
                            }
                            onClick={() => handleDelete(u.id, u.name)}
                            className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px] disabled:opacity-50"
                            style={{ background: "var(--danger-bg)", color: "var(--danger)", borderColor: "var(--danger)" }}
                            title={
                              !canDeleteUser(viewerRole, u.role)
                                ? "Admin tidak boleh menghapus akun Admin atau Super Admin"
                                : u.role === "SUPER_ADMIN" && superAdminTotal <= 1
                                  ? "Tidak boleh menghapus satu-satunya akun Super Admin"
                                  : undefined
                            }
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Halaman {page} dari {totalPages} · {total} pengguna</span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(p)); router.push(`${pathname}?${sp.toString()}`); }} className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded text-xs" style={{ background: p === page ? "var(--accent)" : "var(--bg-primary)", color: p === page ? "white" : "var(--text-secondary)", border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}` }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && mounted
        ? createPortal(
        <div
          className={`fixed inset-0 ${Z_MODAL_CLASS} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border px-4 pt-4 pb-sheet-bottom sm:rounded-xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-serif mb-4 pb-3 border-b" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>{modal === "add" ? "Tambah Pengguna Baru" : `Edit: ${modal.name}`}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                <UserAvatar
                  name={form.name || "User"}
                  userId={modal === "add" ? undefined : modal.id}
                  photoPresent={modal !== "add" && !!modal.photoPresent && photoDraft !== ""}
                  previewSrc={photoDraft && photoDraft !== "" ? photoDraft : null}
                  cacheKey={modal !== "add" && modal.updatedAt ? String(modal.updatedAt) : undefined}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Foto profil
                  </p>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="w-full text-xs"
                    disabled={photoBusy || loading}
                    onChange={(e) => void onPhotoFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(photoDraft || (modal !== "add" && modal.photoPresent && photoDraft !== "")) && (
                      <button
                        type="button"
                        disabled={photoBusy || loading}
                        onClick={() => setPhotoDraft("")}
                        className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px]"
                        style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "var(--danger-bg)" }}
                      >
                        Hapus foto
                      </button>
                    )}
                    {photoDraft !== null && (
                      <button
                        type="button"
                        disabled={photoBusy || loading}
                        onClick={() => setPhotoDraft(null)}
                        className="inline-flex min-h-11 touch-manipulation items-center px-3 py-2 rounded border text-[11px]"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        Batalkan perubahan foto
                      </button>
                    )}
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {photoBusy ? "Mengompres foto…" : "JPG/PNG/HEIC · otomatis dikompres. Kosongkan jika tidak diubah."}
                  </p>
                </div>
              </div>
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
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value as any })}
                    disabled={
                      modal !== "add" &&
                      ((!isSuperAdmin(viewerRole) && (modal?.role === "ADMIN" || modal?.role === "SUPER_ADMIN")) ||
                        (modal?.role === "SUPER_ADMIN" && superAdminTotal <= 1))
                    }
                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:opacity-60"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    title={
                      modal !== "add" && modal?.role === "SUPER_ADMIN" && superAdminTotal <= 1
                        ? "Tambah Super Admin lain dulu — role tidak boleh diturunkan jika hanya ada 1 Super Admin"
                        : undefined
                    }
                  >
                    {ROLES.filter((r) => isSuperAdmin(viewerRole) || r !== "SUPER_ADMIN" || form.role === r).map(r => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                </div>
                {form.role === "STUDENT" && (
                  <>
                  <div>
                    <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      NISN <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
                    </label>
                    <input value={form.nisn} onChange={e => setForm({ ...form, nisn: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div className="col-span-2 rounded-lg border p-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-muted)" }}>
                    <strong style={{ color: "var(--text-secondary)" }}>Telegram ortu (webhook)</strong>
                    <p className="mt-1">
                      Tidak perlu isi manual. Setiap siswa punya tautan unik ke bot sekolah; ortu buka link lalu ketuk Start — chat ID tersimpan otomatis.
                    </p>
                    {modal === "add" ? (
                      <p className="mt-2" style={{ color: "var(--accent)" }}>
                        Setelah Anda simpan siswa baru, tautan ortu otomatis disalin untuk dikirim ke orang tua (pastikan env bot & webhook aktif).
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={loading || !modal?.id}
                          onClick={() => void copyOrtuLink(modal.id)}
                          className="mt-3 w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold"
                          style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-secondary)" }}
                        >
                          Salin tautan Telegram ortu
                        </button>
                        <p className="mt-2 text-[10px]">
                          Perlu tautan baru setelah ortu salah akun? Tombol ini membuat token baru (tautan lama tidak dipakai lagi).
                        </p>
                      </>
                    )}
                  </div>
                  </>
                )}
                {form.role === "STUDENT" && (
                  <div>
                    <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                      Kelas
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
                  <input
                    type="checkbox"
                    id="activeCheck"
                    checked={form.active}
                    disabled={
                      (!isSuperAdmin(viewerRole) && modal !== "add" && modal?.role === "ADMIN") ||
                      modal !== "add" &&
                      form.role === "SUPER_ADMIN" &&
                      modal?.role === "SUPER_ADMIN" &&
                      modal?.active &&
                      activeSuperAdminCount <= 1
                    }
                    onChange={e => setForm({ ...form, active: e.target.checked })}
                  />
                  <label htmlFor="activeCheck" className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Akun aktif
                    {modal !== "add" && form.role === "SUPER_ADMIN" && modal?.active && activeSuperAdminCount <= 1 ? (
                      <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Nonaktifkan hanya jika sudah ada Super Admin aktif lain.
                      </span>
                    ) : null}
                  </label>
                </div>
              </div>
              {error && <div className="p-3 rounded-lg text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>⚠ {error}</div>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Batal</button>
              <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>Simpan</button>
            </div>
          </div>
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
