"use client";

import { useEffect, useState } from "react";

function isImageDataUrl(s: string) {
  return /^data:image\//i.test(s.trim());
}

type Payload = {
  id: string;
  evidenceImageData: string | null;
  studentSignatureData: string | null;
  student: { name: string };
  violationType: { name: string };
};

export function EvidencePreviewModal({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
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

  const img = data?.evidenceImageData?.trim();
  const sig = data?.studentSignatureData?.trim();

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

        {!loading && data && !img && !sig && (
          <p className="py-6 text-center text-xs text-neutral-500">Tidak ada foto atau teks pengakuan untuk catatan ini.</p>
        )}

        {img && (
          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Foto bukti</p>
            <img
              src={img}
              alt="Bukti pelanggaran"
              className="max-h-[min(360px,55vh)] w-full rounded-lg border object-contain bg-neutral-50"
              style={{ borderColor: "var(--border)" }}
            />
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
      </div>
    </div>
  );
}
