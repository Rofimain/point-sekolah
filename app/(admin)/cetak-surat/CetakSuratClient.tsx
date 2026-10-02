"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type StudentHit = {
  id: string;
  name: string;
  nisn: string | null;
  className: string | null;
};

export default function CetakSuratClient() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<StudentHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debouncedQ = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    if (debouncedQ.length < 2) {
      setItems([]);
      setErr(null);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setErr(null);
        try {
          const res = await fetch(`/api/students/search?q=${encodeURIComponent(debouncedQ)}`);
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.error || "Gagal mencari siswa");
          setItems(Array.isArray(d.items) ? d.items : []);
        } catch (e: unknown) {
          setItems([]);
          setErr(e instanceof Error ? e.message : "Gagal mencari");
        } finally {
          setLoading(false);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQ]);

  function pickStudent(id: string) {
    router.push(`/students/${id}/cetak?from=cetak-surat`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="page-title">
          Cetak surat
        </h1>
        <p className="page-subtitle">
          Pilih siswa dulu. Setelah itu pilih jenis surat — placeholder terisi otomatis dari data siswa.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li>Cari dan pilih siswa</li>
          <li>Pilih jenis surat (SP1, skorsing, …)</li>
          <li>Lengkapi nomor/tanggal bila perlu, lalu cetak</li>
        </ol>
      </div>

      <div
        className="card p-5 space-y-3"
      >
        <label
          className="label"
        >
          Cari siswa (nama / NISN / kelas)
        </label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik minimal 2 huruf…"
          autoFocus
          className="input"
        />
        {loading && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Mencari…
          </p>
        )}
        {err && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {err}
          </p>
        )}
        {!loading && debouncedQ.length >= 2 && items.length === 0 && !err && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Tidak ada siswa yang cocok.
          </p>
        )}
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pickStudent(s.id)}
                className="btn btn-secondary h-auto w-full flex-col items-start px-3 py-2.5 text-left"
              >
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {[s.className, s.nisn ? `NISN ${s.nisn}` : null].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Atau buka dari{" "}
        <Link href="/students" className="font-semibold" style={{ color: "var(--accent)" }}>
          Data Siswa
        </Link>{" "}
        → tombol Cetak pada baris siswa.
      </p>
    </div>
  );
}
