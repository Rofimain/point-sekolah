"use client";

import { useEffect, useState } from "react";

function isImageDataUrl(s: string) {
  return /^data:image\//i.test(s.trim());
}

type Payload = {
  id: string;
  evidenceImageData: string | null;
  evidenceImages?: string[];
  studentSignatureData: string | null;
  points: number;
  session: string | null;
  notes: string | null;
  date: string;
  createdAt: string;
  createdByName: string | null;
  student: { name: string };
  violationType: { name: string };
};

export function EvidencePreviewModal({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setActiveIdx(0);
      try {
        const res = await fetch(`/api/records/${recordId}`, { cache: "no-store", credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof json.error === "string" ? json.error : "Gagal memuat");
          setLoading(false);
          return;
        }
        setData(json as Payload);
      } catch {
        if (!cancelled) setError("Gagal memuat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const images =
    data?.evidenceImages && data.evidenceImages.length > 0
      ? data.evidenceImages.filter((s) => s?.trim())
      : data?.evidenceImageData?.trim()
        ? [data.evidenceImageData.trim()]
        : [];
  const sig = data?.studentSignatureData?.trim();
  const activeImg = images[Math.min(activeIdx, Math.max(0, images.length - 1))] ?? null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-preview-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup" onClick={onClose} />
      <div
        className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 id="evidence-preview-title" className="text-sm font-serif font-semibold text-neutral-900">
              Pratinjau bukti
            </h2>
            {data && (
              <p className="mt-1 text-[11px] leading-snug text-neutral-600">
                {data.student.name} · {data.violationType.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Tutup
          </button>
        </div>

        {loading && <p className="py-8 text-center text-xs text-neutral-500">Memuat…</p>}
        {error && !loading && <p className="py-6 text-center text-xs text-red-600">{error}</p>}

        {!loading && data && images.length === 0 && !sig && (
          <p className="py-6 text-center text-xs text-neutral-500">Tidak ada foto atau teks pengakuan untuk catatan ini.</p>
        )}

        {!loading && data ? (
          <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg border bg-neutral-50 p-3 text-xs text-neutral-800">
            <div>
              <dt className="text-[10px] uppercase text-neutral-500">Tanggal</dt>
              <dd>{new Date(data.date).toLocaleDateString("id-ID")}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-neutral-500">Poin</dt>
              <dd>{data.points} poin</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-neutral-500">Sesi</dt>
              <dd>{data.session || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-neutral-500">Diinput oleh</dt>
              <dd>{data.createdByName || "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase text-neutral-500">Keterangan</dt>
              <dd className="whitespace-pre-wrap">{data.notes || "—"}</dd>
            </div>
          </dl>
        ) : null}

        {activeImg && (
          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Foto bukti{images.length > 1 ? ` (${activeIdx + 1}/${images.length})` : ""}
            </p>
            <img
              src={activeImg}
              alt="Bukti pelanggaran"
              className="max-h-[min(420px,58vh)] w-full rounded-lg border object-contain bg-neutral-50"
              style={{ borderColor: "var(--border)" }}
            />
            {images.length > 1 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2"
                    style={{ borderColor: i === activeIdx ? "rgb(16 185 129)" : "var(--border)" }}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {sig && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Pengakuan / tanda tangan
            </p>
            {isImageDataUrl(sig) ? (
              <img src={sig} alt="" className="max-h-48 w-full rounded-lg border object-contain bg-neutral-50" />
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg border bg-neutral-50 p-3 text-xs text-neutral-800">{sig}</pre>
            )}
          </div>
        )}
        {!loading && data ? (
          <a
            href={`/api/records/${encodeURIComponent(recordId)}/evidence-pdf`}
            className="mt-4 block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Unduh laporan PDF
          </a>
        ) : null}
      </div>
    </div>
  );
}
