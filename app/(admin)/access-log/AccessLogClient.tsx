"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PaginationBar } from "@/components/PaginationBar";

type FieldChange = {
  field?: string;
  label?: string;
  from?: string | null;
  to?: string | null;
};

type AccessLogRow = {
  id: string;
  createdAt: string;
  portal: string;
  category: string;
  action: string;
  success: boolean;
  actorName: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  meta: string | null;
  ip: string | null;
  userAgent: string | null;
};

type ListResponse = {
  items: AccessLogRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

const emptyFilters = {
  from: "",
  to: "",
  category: "",
  portal: "",
  action: "",
  q: "",
};

function parseMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function formatMetaDetail(meta: Record<string, unknown> | null): {
  lines: string[];
  changes: FieldChange[];
} {
  if (!meta) return { lines: [], changes: [] };
  const lines: string[] = [];
  const changes = Array.isArray(meta.changes) ? (meta.changes as FieldChange[]) : [];

  if (typeof meta.method === "string") lines.push(`Metode: ${meta.method}`);
  if (typeof meta.identifierKind === "string") lines.push(`Jenis identifier: ${meta.identifierKind}`);
  if (typeof meta.identifier === "string" && meta.identifier) lines.push(`Identifier: ${meta.identifier}`);
  if (typeof meta.authType === "string") lines.push(`Tipe auth: ${meta.authType}`);
  if (typeof meta.provider === "string") lines.push(`Provider: ${meta.provider}`);
  if (typeof meta.reason === "string" && meta.reason) lines.push(`Alasan: ${meta.reason}`);
  if (meta.passwordChanged === true) lines.push("Password: diganti/direset");
  if (meta.photoChanged === true || meta.photoAdded === true) {
    lines.push(meta.photoAdded === true ? "Foto: ditambahkan" : "Foto: diubah");
  }
  if (Array.isArray(meta.fields) && meta.fields.length > 0) {
    lines.push(`Kolom: ${(meta.fields as unknown[]).map(String).join(", ")}`);
  }
  if (typeof meta.email === "string") lines.push(`Email target: ${meta.email}`);
  if (typeof meta.targetEmail === "string") lines.push(`Email target: ${meta.targetEmail}`);
  if (typeof meta.role === "string") lines.push(`Role target: ${meta.role}`);
  if (typeof meta.targetRole === "string") lines.push(`Role target: ${meta.targetRole}`);
  if (typeof meta.status === "string") lines.push(`Status: ${meta.status}`);
  if (typeof meta.actorRole === "string") lines.push(`Role pelaku: ${meta.actorRole}`);

  return { lines, changes };
}

export default function AccessLogClient() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryString = useCallback(
    (p = page) => {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("perPage", "30");
      if (filters.from) sp.set("from", filters.from);
      if (filters.to) sp.set("to", filters.to);
      if (filters.category) sp.set("category", filters.category);
      if (filters.portal) sp.set("portal", filters.portal);
      if (filters.action) sp.set("action", filters.action);
      if (filters.q.trim()) sp.set("q", filters.q.trim());
      return sp.toString();
    },
    [filters, page]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/access-logs?${queryString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gagal memuat log");
      setData(json as ListResponse);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/access-logs/export?${queryString(1)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Gagal export");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `log-akses.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel diunduh");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal export");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="font-serif text-xl font-semibold tracking-tight sm:text-2xl"
            style={{ color: "var(--text-primary)" }}
          >
            Log akses
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Riwayat login (email/NISN/NIP + password atau Google), ganti/reset password, dan perubahan data (termasuk
            foto &amp; kolom yang diubah). Hanya Super Admin. Disimpan 12 bulan.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || loading}
          onClick={() => void exportExcel()}
          className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--bg-secondary)" }}
        >
          {exporting ? "Mengunduh…" : "Unduh Excel"}
        </button>
      </div>

      <div
        className="mb-4 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Dari
          <input
            type="date"
            value={filters.from}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, from: e.target.value }));
            }}
            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Sampai
          <input
            type="date"
            value={filters.to}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, to: e.target.value }));
            }}
            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Kategori
          <select
            value={filters.category}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, category: e.target.value }));
            }}
            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">Semua</option>
            <option value="LOGIN">Login</option>
            <option value="DATA">Data</option>
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Portal
          <select
            value={filters.portal}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, portal: e.target.value }));
            }}
            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">Semua</option>
            <option value="STUDENT">Siswa</option>
            <option value="STAFF">Staf</option>
            <option value="SYSTEM">Sistem</option>
          </select>
        </label>
        <label
          className="text-[10px] font-semibold uppercase tracking-wide sm:col-span-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Cari
          <input
            value={filters.q}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, q: e.target.value }));
            }}
            placeholder="Nama, aksi, ringkasan…"
            className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </label>
      </div>

      <div className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {loading ? "Memuat…" : `${data?.total ?? 0} entri — klik baris untuk detail`}
      </div>

      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr style={{ background: "var(--bg-primary)" }}>
              {["Waktu", "Portal", "Kategori", "Aksi", "Pelaku", "Ringkasan", "IP"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((row) => {
              const open = expandedId === row.id;
              const meta = parseMeta(row.meta);
              const detail = formatMetaDetail(meta);
              return (
                <Fragment key={row.id}>
                  <tr
                    className="border-t cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => setExpandedId(open ? null : row.id)}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {format(new Date(row.createdAt), "dd/MM/yyyy HH:mm")}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{row.portal}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: row.category === "LOGIN" ? "var(--accent-light)" : "var(--bg-primary)",
                          color: row.category === "LOGIN" ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >
                        {row.category}
                      </span>
                      {!row.success && (
                        <span className="ml-1 text-[10px] font-semibold" style={{ color: "var(--danger)" }}>
                          gagal
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {row.action}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div style={{ color: "var(--text-primary)" }}>{row.actorName || "—"}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {row.actorRole || ""}
                      </div>
                    </td>
                    <td className="max-w-md px-3 py-2.5 text-xs leading-snug" style={{ color: "var(--text-primary)" }}>
                      {row.summary}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {row.ip || "—"}
                    </td>
                  </tr>
                  {open ? (
                    <tr style={{ background: "var(--bg-primary)" }}>
                      <td colSpan={7} className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">Detail</div>
                            {detail.lines.length === 0 && detail.changes.length === 0 ? (
                              <p style={{ color: "var(--text-muted)" }}>Tidak ada meta tambahan.</p>
                            ) : (
                              <ul className="list-disc space-y-0.5 pl-4">
                                {detail.lines.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            )}
                            {detail.changes.length > 0 ? (
                              <div
                                className="mt-2 overflow-x-auto rounded-lg border"
                                style={{ borderColor: "var(--border)" }}
                              >
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr style={{ background: "var(--bg-secondary)" }}>
                                      <th className="px-2 py-1.5">Kolom</th>
                                      <th className="px-2 py-1.5">Sebelum</th>
                                      <th className="px-2 py-1.5">Sesudah</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.changes.map((c, i) => (
                                      <tr
                                        key={`${c.field}-${i}`}
                                        className="border-t"
                                        style={{ borderColor: "var(--border)" }}
                                      >
                                        <td className="px-2 py-1.5 font-medium">{c.label || c.field || "—"}</td>
                                        <td className="px-2 py-1.5 break-all">{c.from ?? "—"}</td>
                                        <td className="px-2 py-1.5 break-all">{c.to ?? "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                              Target / perangkat
                            </div>
                            <p>Target: {[row.targetType, row.targetId].filter(Boolean).join(" / ") || "—"}</p>
                            <p className="mt-1 break-all" style={{ color: "var(--text-muted)" }}>
                              UA: {row.userAgent || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!loading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Belum ada log untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && !loading && data.totalPages > 1 ? (
        <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <PaginationBar page={data.page} totalPages={data.totalPages} onPageChange={(p) => setPage(p)} />
        </div>
      ) : null}
    </div>
  );
}
