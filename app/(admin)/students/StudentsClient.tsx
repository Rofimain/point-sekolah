"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";
import { parseStudentBulkPaste } from "@/lib/parse-student-bulk";
import { canManageData } from "@/lib/staff-roles";
import {
  COMPRESS_MAX_DIM_AVATAR,
  COMPRESS_TARGET_BYTES_AVATAR,
  compressImageToDataUrl,
  isProbablyImageFile,
} from "@/lib/compress-image-client";
import { lockAppScroll, Z_MODAL_CLASS, Z_MODAL_ELEVATED_CLASS } from "@/lib/ui-layers";

const GRADES = ["X", "XI", "XII"] as const;

type FlashMsg = { type: "ok" | "err"; text: string };

function FlashBanner({ msg, className = "mb-4" }: { msg: FlashMsg; className?: string }) {
  return (
    <div
      role="alert"
      className={`rounded-xl px-4 py-3 text-sm ${className}`}
      style={{
        background: msg.type === "ok" ? "var(--success-bg)" : "var(--danger-bg)",
        color: msg.type === "ok" ? "var(--success)" : "var(--danger)",
      }}
    >
      {msg.text}
    </div>
  );
}

type ClassOpt = {
  id: string;
  name: string;
  grade: string;
  major: string;
  year: string;
  _count: { students: number };
};
type StudentRow = {
  id: string;
  name: string;
  email: string;
  nisn: string | null;
  active: boolean;
  photoPresent?: boolean;
  class: { name: string; grade: string } | null;
};

export default function StudentsClient({
  students,
  total,
  page,
  perPage,
  classes,
  searchParams,
  studentDomain,
  viewerRole,
  suggestedYear,
}: {
  students: StudentRow[];
  total: number;
  page: number;
  perPage: number;
  classes: ClassOpt[];
  searchParams: { search?: string; page?: string; tab?: string; classId?: string };
  studentDomain: string;
  viewerRole: string;
  suggestedYear: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const totalPages = Math.ceil(total / perPage);
  const canManage = canManageData(viewerRole);
  type StudentsPanelTab = "single" | "bulk" | "kelas";
  const tab: StudentsPanelTab | null =
    !canManage
      ? null
      : searchParams.tab === "kelas"
      ? "kelas"
      : searchParams.tab === "bulk"
        ? "bulk"
        : searchParams.tab === "single"
          ? "single"
          : null;

  function setTabQuery(next: StudentsPanelTab | null) {
    const sp = new URLSearchParams(searchParams as Record<string, string>);
    if (next == null) sp.delete("tab");
    else if (next === "single") sp.set("tab", "single");
    else sp.set("tab", next);
    sp.delete("page");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }
  const [search, setSearch] = useState(searchParams.search || "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<FlashMsg | null>(null);

  const [name, setName] = useState("");
  const [nisn, setNisn] = useState("");
  const [classId, setClassId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkDefaultPwd, setBulkDefaultPwd] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    failed: number;
    errors: { row: number; message: string }[];
    truncatedErrors?: boolean;
    telegramOrtuNote?: string;
    photosAttached?: number;
    unmatchedPhotos?: string[];
    photoErrors?: { file: string; message: string }[];
  } | null>(null);

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [classGrade, setClassGrade] = useState<string>("X");
  const [classMajor, setClassMajor] = useState("");
  const [classYear, setClassYear] = useState(suggestedYear);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const overlayOpen = Boolean(tab) || classModalOpen;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!overlayOpen) return;
    return lockAppScroll();
  }, [overlayOpen]);

  useEffect(() => {
    setSearch(searchParams.search || "");
  }, [searchParams.search]);

  const previewRows = useMemo(() => {
    try {
      return parseStudentBulkPaste(bulkText);
    } catch {
      return [];
    }
  }, [bulkText]);

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams as Record<string, string>);
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    sp.delete("page");
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  async function downloadExcelTemplate() {
    try {
      const res = await fetch("/api/students/import-template");
      if (!res.ok) throw new Error("Gagal mengunduh template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template-import-siswa.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg({ type: "err", text: "Tidak bisa mengunduh template. Coba login ulang." });
    }
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

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim() || !nisn.trim() || !classId) {
      setMsg({ type: "err", text: "Lengkapi nama, NISN, dan kelas." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nisn: nisn.trim(),
          classId,
          email: email.trim() || undefined,
          password: password.trim() || undefined,
          photoData: photoDraft || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setMsg({ type: "ok", text: `Siswa "${name}" berhasil ditambahkan.` });
      if (data.ortuTelegramLink) {
        try {
          await navigator.clipboard.writeText(data.ortuTelegramLink);
          toast.success("Tautan untuk ortu sudah disalin — kirim lewat WA; ortu buka lalu Start.");
        } catch {
          toast.info(data.ortuTelegramLink);
        }
      }
      setName("");
      setNisn("");
      setClassId("");
      setEmail("");
      setPassword("");
      setPhotoDraft(null);
      setTabQuery(null);
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setLoading(false);
    }
  }

  async function submitClass(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = className.trim();
    if (!n) {
      setMsg({ type: "err", text: "Nama kelas wajib diisi." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          grade: classGrade.trim(),
          major: classMajor.trim() || undefined,
          year: classYear.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menambah kelas");
      setMsg({ type: "ok", text: `Kelas "${n}" berhasil ditambahkan.` });
      setClassName("");
      setClassMajor("");
      setClassModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setLoading(false);
    }
  }

  async function deleteClassRow(classId: string, classLabel: string, studentCount: number) {
    const warn =
      studentCount > 0
        ? `Hapus kelas "${classLabel}"?\n\n${studentCount} siswa akan dilepas dari kelas ini (akun & riwayat pelanggaran tetap ada).`
        : `Hapus kelas "${classLabel}"?`;
    if (!confirm(warn)) return;
    setDeletingClassId(classId);
    setMsg(null);
    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(classId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghapus kelas");
      setMsg({ type: "ok", text: `Kelas "${data.removedClassName ?? classLabel}" berhasil dihapus.` });
      if (searchParams.classId === classId) navigate({ classId: "" });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setDeletingClassId(null);
    }
  }

  async function submitBulkFile(file: File) {
    setMsg(null);
    setBulkResult(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const dp = bulkDefaultPwd.trim();
      if (dp) fd.set("defaultPassword", dp);
      const res = await fetch("/api/students/import-file", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Impor file gagal");
      setBulkResult({
        created: data.created,
        failed: data.failed,
        errors: data.errors || [],
        truncatedErrors: data.truncatedErrors,
        telegramOrtuNote: data.telegramOrtuNote,
        photosAttached: data.photosAttached,
        unmatchedPhotos: data.unmatchedPhotos,
        photoErrors: data.photoErrors,
      });
      setMsg({
        type: data.failed ? "err" : "ok",
        text: `File: ${data.created} siswa ditambahkan${data.failed ? `, ${data.failed} baris gagal.` : "."}${
          data.photosAttached ? ` Foto terpasang: ${data.photosAttached}.` : ""
        }`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!data.failed) setTabQuery(null);
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setLoading(false);
    }
  }

  async function submitBulk() {
    setMsg(null);
    setBulkResult(null);
    const rows = parseStudentBulkPaste(bulkText);
    if (rows.length === 0) {
      setMsg({ type: "err", text: "Tidak ada baris valid. Tempel data dari Excel atau isi contoh template." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          defaultPassword: bulkDefaultPwd.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Impor gagal");
      setBulkResult({
        created: data.created,
        failed: data.failed,
        errors: data.errors || [],
        truncatedErrors: data.truncatedErrors,
        telegramOrtuNote: data.telegramOrtuNote,
      });
      setMsg({
        type: data.failed ? "err" : "ok",
        text: `Selesai: ${data.created} siswa ditambahkan${data.failed ? `, ${data.failed} baris gagal.` : "."}`,
      });
      setBulkText("");
      if (!data.failed) setTabQuery(null);
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Gagal" });
    } finally {
      setLoading(false);
    }
  }

  const autoEmailPreview =
    nisn.trim() && !email.trim()
      ? `${nisn.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}@${studentDomain}`
      : null;

  const selectedClass = searchParams.classId
    ? classes.find((c) => c.id === searchParams.classId) ?? null
    : null;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {selectedClass ? (
            <>
              <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Navigasi kelas">
                <Link href="/students" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                  Semua kelas
                </Link>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <span style={{ color: "var(--text-secondary)" }}>{selectedClass.name}</span>
              </nav>
              <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
                {selectedClass.name}
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Daftar siswa di kelas ini
                {selectedClass.grade ? ` · Tingkat ${selectedClass.grade}` : ""}
                {selectedClass.year ? ` · ${selectedClass.year}` : ""}.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
                Data siswa
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {tab === null
                  ? "Semua siswa terdaftar. Pilih kelas di menu samping untuk membuka kategori kelas."
                  : tab === "single"
                    ? "Popup: tambah satu siswa. Tutup lewat tombol Tutup atau area gelap di luar kartu."
                    : tab === "bulk"
                      ? "Popup: impor banyak siswa. Nama kelas di file harus sama persis dengan daftar kelas."
                      : "Popup: kelola daftar kelas."}
              </p>
            </>
          )}
          {tab === null && !selectedClass && (
            <p className="mt-1 hidden max-w-2xl text-[10px] leading-relaxed text-balance sm:block" style={{ color: "var(--text-muted)" }}>
              Nama kelas di impor harus <strong style={{ color: "var(--text-secondary)" }}>sama persis</strong> dengan yang di tab Kelas. Login siswa:{" "}
              <strong style={{ color: "var(--text-secondary)" }}>nisn@{studentDomain}</strong> bila email dikosongkan.
            </p>
          )}
        </div>
        {canManage && <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[min(100%,18rem)]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setTabQuery("single");
              }}
              className="touch-manipulation min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:py-2"
              style={{
                background: tab === "single" ? "var(--accent)" : "var(--bg-secondary)",
                color: tab === "single" ? "white" : "var(--text-secondary)",
                border: `1px solid ${tab === "single" ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              Tambah siswa
            </button>
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setBulkResult(null);
                setTabQuery("bulk");
              }}
              className="touch-manipulation min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:py-2"
              style={{
                background: tab === "bulk" ? "var(--accent)" : "var(--bg-secondary)",
                color: tab === "bulk" ? "white" : "var(--text-secondary)",
                border: `1px solid ${tab === "bulk" ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              Impor bulk
            </button>
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setTabQuery("kelas");
              }}
              className="touch-manipulation min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:py-2"
              style={{
                background: tab === "kelas" ? "var(--accent)" : "var(--bg-secondary)",
                color: tab === "kelas" ? "white" : "var(--text-secondary)",
                border: `1px solid ${tab === "kelas" ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              Kelas
            </button>
          </div>
        </div>}
      </div>

      {msg && !overlayOpen && <FlashBanner msg={msg} />}

      <div id="daftar-siswa" className="mb-6 scroll-mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate({ search: search.trim() })}
          placeholder={
            selectedClass
              ? `Cari di ${selectedClass.name} — nama, NISN, email…`
              : "Cari nama, NISN, email…"
          }
          className="min-w-0 flex-1 basis-full rounded-lg border px-3 py-2 text-xs sm:basis-auto sm:min-w-[12rem]"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={() => navigate({ search: search.trim() })}
          className="btn-primary px-4 py-2 text-xs"
        >
          Cari
        </button>
        {searchParams.search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              navigate({ search: "" });
            }}
            className="px-3 py-2 rounded-lg border text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Reset pencarian
          </button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {selectedClass
              ? `${total} siswa di kelas ${selectedClass.name}`
              : `${total} siswa terdaftar`}
          </span>
          {canManage && (
            <a href="/users?role=STUDENT" className="text-xs font-medium hover:underline break-words" style={{ color: "var(--accent)" }}>
              Edit lanjutan / nonaktifkan → Manajemen user
            </a>
          )}
        </div>
        <div className="overflow-x-auto">
          {students.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {selectedClass
                ? `Belum ada siswa di kelas ${selectedClass.name}.`
                : "Belum ada siswa di halaman ini."}
            </div>
          ) : (
            <>
              <ul className="divide-y md:hidden" style={{ borderColor: "var(--border)" }}>
                {students.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-start gap-3 px-4 py-3"
                    style={{ opacity: u.active ? 1 : 0.55 }}
                  >
                    <UserAvatar
                      name={u.name}
                      userId={u.id}
                      photoPresent={!!u.photoPresent}
                      size="md"
                      rounded="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold break-words" style={{ color: "var(--text-primary)" }}>
                          {u.name}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            background: u.active ? "var(--success-bg)" : "var(--bg-tertiary)",
                            color: u.active ? "var(--success)" : "var(--text-muted)",
                          }}
                        >
                          {u.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        NISN: {u.nisn || "—"}
                      </div>
                      {!selectedClass ? (
                        <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {u.class?.name ?? "—"}
                        </div>
                      ) : null}
                      <div className="mt-0.5 break-all text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {u.email}
                      </div>
                      <Link
                        href={`/students/${u.id}/cetak`}
                        className="mt-2 inline-flex min-h-11 touch-manipulation items-center text-xs font-semibold hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        Cetak surat
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full min-w-[520px] md:table">
            <thead>
              <tr style={{ background: "var(--bg-primary)" }}>
                {(selectedClass
                  ? ["Siswa", "NISN", "Email", "Status", "Cetak"]
                  : ["Siswa", "NISN", "Email", "Kelas", "Status", "Cetak"]
                ).map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
                {students.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", opacity: u.active ? 1 : 0.55 }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={u.name}
                          userId={u.id}
                          photoPresent={!!u.photoPresent}
                          size="md"
                          rounded="lg"
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {u.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {u.nisn || "—"}
                    </td>
                    <td className="px-4 py-3 text-[11px] break-all max-w-[200px]" style={{ color: "var(--text-muted)" }}>
                      {u.email}
                    </td>
                    {!selectedClass && (
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                        {u.class?.name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{
                          background: u.active ? "var(--success-bg)" : "var(--bg-tertiary)",
                          color: u.active ? "var(--success)" : "var(--text-muted)",
                        }}
                      >
                        {u.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/students/${u.id}/cetak`}
                        className="inline-flex min-h-11 items-center text-xs font-semibold hover:underline touch-manipulation"
                        style={{ color: "var(--accent)" }}
                      >
                        Cetak surat
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
            </>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Halaman {page} / {totalPages}
            </span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const sp = new URLSearchParams(searchParams as Record<string, string>);
                    sp.set("page", String(p));
                    router.push(`${pathname}?${sp.toString()}`);
                  }}
                  className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded text-xs"
                  style={{
                    background: p === page ? "var(--accent)" : "var(--bg-primary)",
                    color: p === page ? "white" : "var(--text-secondary)",
                    border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>

      {classModalOpen && mounted
        ? createPortal(
        <div
          className={`fixed inset-0 ${Z_MODAL_ELEVATED_CLASS} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
          onClick={() => setClassModalOpen(false)}
        >
          <form
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border px-4 pt-4 pb-sheet-bottom shadow-xl sm:rounded-2xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitClass}
          >
            <h3 className="mb-1 text-base font-serif" style={{ color: "var(--text-primary)" }}>
              Kelas baru
            </h3>
            <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
              Setelah tersimpan, kelas langsung bisa dipilih saat menambah siswa.
            </p>
            {msg && <FlashBanner msg={msg} />}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Nama kelas *
                </label>
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Mis. XI IPA 2"
                  required
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Angkatan *
                </label>
                <select
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Jurusan
                </label>
                <input
                  value={classMajor}
                  onChange={(e) => setClassMajor(e.target.value)}
                  placeholder="MIPA, IPS, …"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Tahun ajaran *
                </label>
                <input
                  value={classYear}
                  onChange={(e) => setClassYear(e.target.value)}
                  required
                  className="w-full rounded-xl border px-3 py-2.5 font-mono text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClassModalOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {loading ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </div>,
            document.body
          )
        : null}

      {tab === "single" && mounted
        ? createPortal(
        <div
          className={`fixed inset-0 ${Z_MODAL_CLASS} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-add-title"
          onClick={() => setTabQuery(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border px-4 pt-4 pb-sheet-bottom shadow-xl sm:mx-4 sm:max-h-[min(92dvh,42rem)] sm:rounded-2xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h2 id="student-add-title" className="text-base font-semibold font-serif" style={{ color: "var(--text-primary)" }}>
                Tambah siswa
              </h2>
              <button
                type="button"
                onClick={() => setTabQuery(null)}
                className="touch-manipulation shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
              >
                Tutup
              </button>
            </div>
            {msg && <FlashBanner msg={msg} />}
            <form onSubmit={submitSingle}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Nama lengkap *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                NISN *
              </label>
              <input
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                required
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Kelas *
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">— Pilih kelas —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.trim() || c.grade || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Email <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kosong = otomatis dari NISN"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              {autoEmailPreview && (
                <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Akan dipakai: <span style={{ color: "var(--accent)" }}>{autoEmailPreview}</span>
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Password awal <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kosong = password default sekolah"
                autoComplete="off"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Foto profil <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={(e) => void onPhotoFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={photoBusy || loading}
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
                >
                  {photoBusy ? "Memproses…" : photoDraft ? "Ganti foto" : "Pilih foto"}
                </button>
                {photoDraft && (
                  <>
                    <UserAvatar name={name || "Siswa"} size="lg" previewSrc={photoDraft} />
                    <button
                      type="button"
                      onClick={() => setPhotoDraft(null)}
                      className="text-xs font-semibold"
                      style={{ color: "var(--danger)" }}
                    >
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="rounded-xl border p-3 text-[11px] leading-relaxed" style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text-secondary)" }}>Telegram ortu</strong>
              <p className="mt-1">
                Hubungan ortu lewat tautan unik + webhook (tanpa isi manual di sini). Setelah simpan, tautan untuk ortu disalin otomatis — kirim ke orang tua; mereka buka di Telegram lalu Start.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Menyimpan…" : "Simpan siswa"}
          </button>
            </form>
          </div>
        </div>,
            document.body
          )
        : null}

      {tab === "bulk" && mounted
        ? createPortal(
        <div
          className={`fixed inset-0 ${Z_MODAL_CLASS} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-import-title"
          onClick={() => setTabQuery(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl border px-4 pt-4 pb-sheet-bottom shadow-xl sm:mx-4 sm:max-h-[min(92dvh,48rem)] sm:rounded-2xl sm:p-6"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0 flex-1">
              <h2 id="bulk-import-title" className="text-base font-semibold font-serif" style={{ color: "var(--text-primary)" }}>
                Impor banyak siswa
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Unggah <strong style={{ color: "var(--text-secondary)" }}>.xlsx</strong> atau paket{" "}
                <strong style={{ color: "var(--text-secondary)" }}>.zip</strong> (Excel + folder{" "}
                <code className="text-[10px]">foto/</code> bernama NISN), atau tempel CSV/tab. Kolom:{" "}
                <code className="text-[10px]">nama</code>, <code className="text-[10px]">nisn</code>,{" "}
                <code className="text-[10px]">nama_kelas</code>, <code className="text-[10px]">email</code>,{" "}
                <code className="text-[10px]">password</code>. Foto profil hanya lewat unggah ZIP. Telegram ortu diisi setelah impor via Manajemen Pengguna.
              </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void downloadExcelTemplate()}
                className="rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
              >
                Unduh template Excel
              </button>
              <button
                type="button"
                onClick={() => setTabQuery(null)}
                className="touch-manipulation rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
              >
                Tutup
              </button>
              </div>
            </div>

            {msg && <FlashBanner msg={msg} />}

          <div
            className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void submitBulkFile(f);
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Memproses…" : "Unggah .xlsx / .zip"}
            </button>
            <p className="max-w-md text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              .xlsx maks. 8 MB; ZIP + foto maks. 40 MB. Struktur ZIP: <code className="text-[10px]">data.xlsx</code> +{" "}
              <code className="text-[10px]">foto/0012345678.jpg</code>. Password default di bawah untuk baris tanpa kolom password.
            </p>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Password default (semua baris tanpa kolom password)
              </label>
              <input
                type="text"
                value={bulkDefaultPwd}
                onChange={(e) => setBulkDefaultPwd(e.target.value)}
                placeholder="Kosong = Siswa@123456 atau dari server"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="flex items-end">
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Maks. 500 baris per sekali kirim. Baris gagal tidak menghentikan yang lain.
              </p>
            </div>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={`Contoh (tab):\nnama\tnisn\tnama_kelas\nBudi\t0011122233\tX MIPA 1`}
            className="w-full rounded-xl border px-3 py-2 font-mono text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pratinjau: <strong style={{ color: "var(--text-primary)" }}>{previewRows.length}</strong> baris siap kirim
            </span>
            <button
              type="button"
              onClick={submitBulk}
              disabled={loading || previewRows.length === 0}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Mengimpor…" : "Impor sekarang"}
            </button>
          </div>

          {bulkResult && bulkResult.errors.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <div className="mb-2 text-xs font-semibold" style={{ color: "var(--danger)" }}>
                Detail baris gagal
              </div>
              <ul className="space-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {bulkResult.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {bulkResult.truncatedErrors && (
                <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Hanya 50 error pertama ditampilkan.
                </p>
              )}
            </div>
          )}

          {bulkResult && ((bulkResult.photoErrors?.length ?? 0) > 0 || (bulkResult.unmatchedPhotos?.length ?? 0) > 0) && (
            <div className="mt-4 max-h-36 overflow-y-auto rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <div className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Catatan foto
              </div>
              <ul className="space-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {(bulkResult.photoErrors || []).map((e) => (
                  <li key={`pe-${e.file}-${e.message}`}>
                    {e.file}: {e.message}
                  </li>
                ))}
                {(bulkResult.unmatchedPhotos || []).map((n) => (
                  <li key={`up-${n}`}>Foto NISN {n} tidak cocok dengan baris Excel</li>
                ))}
              </ul>
            </div>
          )}

          {bulkResult && bulkResult.created > 0 && bulkResult.telegramOrtuNote && (
            <div
              className="mt-4 rounded-xl border p-3 text-[11px] leading-relaxed"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-muted)" }}
            >
              <strong style={{ color: "var(--text-secondary)" }}>Telegram orang tua setelah impor</strong>
              <p className="mt-1">{bulkResult.telegramOrtuNote}</p>
            </div>
          )}
          </div>
        </div>,
            document.body
          )
        : null}

      {tab === "kelas" && mounted
        ? createPortal(
        <div
          className={`fixed inset-0 ${Z_MODAL_CLASS} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="class-list-title"
          onClick={() => setTabQuery(null)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border shadow-xl sm:mx-4 sm:max-h-[min(92dvh,50rem)] sm:rounded-2xl"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
            <div className="min-w-0 flex-1">
              <h2 id="class-list-title" className="text-base font-semibold font-serif" style={{ color: "var(--text-primary)" }}>
                Daftar kelas
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Kelas dipakai di form siswa dan kolom <code className="text-[10px]">nama_kelas</code> pada impor Excel. Contoh nama:{" "}
                <strong>X MIPA 1</strong>. Untuk menghapus kelas, gunakan tombol <strong>Hapus</strong> pada baris — siswa di kelas itu otomatis
                tidak memiliki kelas sampai Anda pilih kelas lagi.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setClassModalOpen(true);
                setMsg(null);
                setClassYear(suggestedYear);
              }}
              className="rounded-xl border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
            >
              + Tambah kelas
            </button>
            <button
              type="button"
              onClick={() => setTabQuery(null)}
              className="touch-manipulation rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
            >
              Tutup
            </button>
            </div>
          </div>
          {msg && !classModalOpen && (
            <div className="shrink-0 px-4 pt-2 sm:px-6">
              <FlashBanner msg={msg} className="mb-2" />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-sheet-bottom pt-2 sm:px-6">
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <div className="max-h-[min(55dvh,24rem)] overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["Nama kelas", "Angkatan", "Jurusan", "Tahun ajaran", "Jumlah siswa", "Aksi"].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                        Belum ada kelas. Klik &quot;Tambah kelas&quot;.
                      </td>
                    </tr>
                  ) : (
                    classes.map((c) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {c.name}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {c.grade}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {c.major || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                          {c.year}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex min-w-[2rem] justify-center rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums"
                            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                          >
                            {c._count.students}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={deletingClassId === c.id}
                            onClick={() => deleteClassRow(c.id, c.name, c._count.students)}
                            className="touch-manipulation rounded-lg border px-3 py-2.5 text-[11px] font-semibold min-h-11 disabled:opacity-50"
                            style={{
                              borderColor: "var(--danger)",
                              color: "var(--danger)",
                              background: "var(--bg-secondary)",
                            }}
                          >
                            {deletingClassId === c.id ? "Menghapus…" : "Hapus"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
          </div>
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
