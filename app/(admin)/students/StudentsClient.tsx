"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getInitials } from "@/lib/utils";
import { parseStudentBulkPaste, bulkImportTemplateTsv } from "@/lib/parse-student-bulk";

type ClassOpt = { id: string; name: string; grade: string };
type StudentRow = {
  id: string;
  name: string;
  email: string;
  nisn: string | null;
  active: boolean;
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
}: {
  students: StudentRow[];
  total: number;
  page: number;
  perPage: number;
  classes: ClassOpt[];
  searchParams: { search?: string; page?: string };
  studentDomain: string;
  viewerRole: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.ceil(total / perPage);
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [search, setSearch] = useState(searchParams.search || "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [nisn, setNisn] = useState("");
  const [classId, setClassId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [bulkDefaultPwd, setBulkDefaultPwd] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    failed: number;
    errors: { row: number; message: string }[];
    truncatedErrors?: boolean;
  } | null>(null);

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

  function downloadTemplate() {
    const blob = new Blob([bulkImportTemplateTsv()], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-siswa.tsv";
    a.click();
    URL.revokeObjectURL(url);
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setMsg({ type: "ok", text: `Siswa "${name}" berhasil ditambahkan.` });
      setName("");
      setNisn("");
      setClassId("");
      setEmail("");
      setPassword("");
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
      });
      setMsg({
        type: data.failed ? "err" : "ok",
        text: `Selesai: ${data.created} siswa ditambahkan${data.failed ? `, ${data.failed} baris gagal.` : "."}`,
      });
      setBulkText("");
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
          Data siswa
        </h1>
        <p className="text-xs mt-0.5 max-w-2xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Tambah siswa satu per satu atau impor banyak sekaligus dari Excel/CSV. Email login otomatis{" "}
          <strong style={{ color: "var(--text-secondary)" }}>nisn@{studentDomain}</strong> jika dikosongkan. Password
          default siswa baru bisa diatur lewat variabel lingkungan <code className="text-[10px]">DEFAULT_STUDENT_PASSWORD</code>{" "}
          (bawaan: Siswa@1234).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab("single")}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{
            background: tab === "single" ? "var(--accent)" : "var(--bg-secondary)",
            color: tab === "single" ? "white" : "var(--text-secondary)",
            border: `1px solid ${tab === "single" ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          Tambah satuan
        </button>
        <button
          type="button"
          onClick={() => setTab("bulk")}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{
            background: tab === "bulk" ? "var(--accent)" : "var(--bg-secondary)",
            color: tab === "bulk" ? "white" : "var(--text-secondary)",
            border: `1px solid ${tab === "bulk" ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          Impor bulk (Excel / CSV)
        </button>
      </div>

      {msg && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{
            background: msg.type === "ok" ? "var(--success-bg)" : "var(--danger-bg)",
            color: msg.type === "ok" ? "var(--success)" : "var(--danger)",
          }}
        >
          {msg.text}
        </div>
      )}

      {tab === "single" && (
        <form
          onSubmit={submitSingle}
          className="rounded-2xl border p-6 mb-8 max-w-xl"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Form siswa baru
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Nama lengkap *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                NISN *
              </label>
              <input
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Kelas *
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">— Pilih kelas —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade} · {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Email <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`kosong = otomatis dari NISN`}
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              {autoEmailPreview && (
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Akan dipakai: <span style={{ color: "var(--accent)" }}>{autoEmailPreview}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Password awal <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kosong = password default sekolah"
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Menyimpan…" : "Simpan siswa"}
          </button>
        </form>
      )}

      {tab === "bulk" && (
        <div className="rounded-2xl border p-6 mb-8" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Impor banyak siswa
              </h2>
              <p className="text-xs mt-1 max-w-xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Salin dari Excel (disarankan: tab antar kolom) atau CSV. Baris pertama boleh berisi judul:{" "}
                <code className="text-[10px]">nama</code>, <code className="text-[10px]">nisn</code>,{" "}
                <code className="text-[10px]">nama_kelas</code> (harus sama persis dengan nama kelas di sistem),{" "}
                <code className="text-[10px]">email</code>, <code className="text-[10px]">password</code> — semua opsional
                kecuali nama, nisn, kelas.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-3 py-2 rounded-xl border text-xs font-semibold shrink-0"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-primary)" }}
            >
              Unduh template .tsv
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                Password default (semua baris tanpa kolom password)
              </label>
              <input
                type="text"
                value={bulkDefaultPwd}
                onChange={(e) => setBulkDefaultPwd(e.target.value)}
                placeholder="Kosong = Siswa@1234 atau dari server"
                className="w-full px-3 py-2 rounded-xl border text-sm"
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
            rows={12}
            placeholder={`Contoh (tab):\nnama\tnisn\tnama_kelas\nBudi\t0011122233\tX MIPA 1`}
            className="w-full px-3 py-2 rounded-xl border text-sm font-mono"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pratinjau: <strong style={{ color: "var(--text-primary)" }}>{previewRows.length}</strong> baris siap kirim
            </span>
            <button
              type="button"
              onClick={submitBulk}
              disabled={loading || previewRows.length === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {loading ? "Mengimpor…" : "Impor sekarang"}
            </button>
          </div>

          {bulkResult && bulkResult.errors.length > 0 && (
            <div className="mt-4 rounded-xl border p-3 max-h-48 overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--danger)" }}>
                Detail baris gagal
              </div>
              <ul className="text-[11px] space-y-1" style={{ color: "var(--text-secondary)" }}>
                {bulkResult.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {bulkResult.truncatedErrors && (
                <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                  Hanya 50 error pertama ditampilkan.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border p-3 mb-4 flex flex-wrap gap-2" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate({ search })}
          placeholder="Cari nama, NISN, email… (Enter)"
          className="px-3 py-2 rounded-lg border text-xs flex-1 min-w-48"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        {searchParams.search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              router.push(pathname);
            }}
            className="px-3 py-2 rounded-lg border text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Reset
          </button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="px-4 py-2 border-b flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {total} siswa terdaftar
          </span>
          {viewerRole === "SUPER_ADMIN" && (
            <a href="/users?role=STUDENT" className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
              Edit lanjutan / nonaktifkan → Manajemen user
            </a>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--bg-primary)" }}>
                {["Siswa", "NISN", "Email", "Kelas", "Status"].map((h) => (
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
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Belum ada siswa di halaman ini.
                  </td>
                </tr>
              ) : (
                students.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", opacity: u.active ? 1 : 0.55 }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--accent), #1A2340)" }}
                        >
                          {getInitials(u.name)}
                        </div>
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
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {u.class ? `${u.class.grade} ${u.class.name}` : "—"}
                    </td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Halaman {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const sp = new URLSearchParams(searchParams as Record<string, string>);
                    sp.set("page", String(p));
                    router.push(`${pathname}?${sp.toString()}`);
                  }}
                  className="w-7 h-7 rounded text-xs"
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
  );
}
