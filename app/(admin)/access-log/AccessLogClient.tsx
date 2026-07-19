"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  ip: string | null;
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
  scope: "active" as "active" | "archive",
};

export default function AccessLogClient() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const queryString = useCallback(
    (p = page) => {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("perPage", "30");
      sp.set("scope", filters.scope);
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
          <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>
            Log akses
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Riwayat login (portal siswa &amp; staf) dan perubahan data. Hanya Super Admin. Tampilan aktif: 12 bulan terakhir;
            arsip: 12–24 bulan. Lebih dari 24 bulan dihapus otomatis (cron harian).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border p-0.5" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setFilters((f) => ({ ...f, scope: "active" }));
              }}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{
                background: filters.scope === "active" ? "var(--accent)" : "transparent",
                color: filters.scope === "active" ? "white" : "var(--text-secondary)",
              }}
            >
              Aktif (12 bln)
            </button>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setFilters((f) => ({ ...f, scope: "archive" }));
              }}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{
                background: filters.scope === "archive" ? "var(--accent)" : "transparent",
                color: filters.scope === "archive" ? "white" : "var(--text-secondary)",
              }}
            >
              Arsip (12–24 bln)
            </button>
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
        <label className="text-[10px] font-semibold uppercase tracking-wide sm:col-span-2" style={{ color: "var(--text-secondary)" }}>
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
        {loading ? "Memuat…" : `${data?.total ?? 0} entri`}
      </div>

      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr style={{ background: "var(--bg-primary)" }}>
              {["Waktu", "Portal", "Kategori", "Aksi", "Pelaku", "Ringkasan", "IP"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: "var(--border)" }}>
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
                <td className="max-w-xs px-3 py-2.5 text-xs leading-snug" style={{ color: "var(--text-primary)" }}>
                  {row.summary}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {row.ip || "—"}
                </td>
              </tr>
            ))}
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

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Sebelumnya
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Halaman {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
