"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lockAppScroll, Z_MODAL_CLASS } from "@/lib/ui-layers";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => lockAppScroll(), []);

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

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_MODAL_CLASS} flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-preview-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup" onClick={onClose} />
      <div
        className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border p-4 pb-sheet-bottom shadow-2xl sm:rounded-2xl sm:p-5 sm:pb-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0 flex-1">
            <h2 id="evidence-preview-title" className="text-sm font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
              Pratinjau bukti
            </h2>
            {data && (
              <p className="mt-1 text-[11px] leading-snug break-words" style={{ color: "var(--text-secondary)" }}>
                {data.student.name} · {data.violationType.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg px-2 text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
            aria-label="Tutup"
          >
            Tutup
          </button>
        </div>

        {loading && (
          <p className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Memuat…
          </p>
        )}
        {error && !loading && (
          <p className="py-6 text-center text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {!loading && data && images.length === 0 && !sig && (
          <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Tidak ada foto atau teks pengakuan untuk catatan ini.
          </p>
        )}

        {!loading && data ? (
          <dl
            className="mb-4 grid grid-cols-2 gap-3 rounded-lg border p-3 text-xs"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <div>
              <dt className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                Tanggal
              </dt>
              <dd>{new Date(data.date).toLocaleDateString("id-ID")}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                Poin
              </dt>
              <dd>{data.points} poin</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                Sesi
              </dt>
              <dd>{data.session || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                Diinput oleh
              </dt>
              <dd className="break-words">{data.createdByName || "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                Keterangan
              </dt>
              <dd className="break-words whitespace-pre-wrap">{data.notes || "—"}</dd>
            </div>
          </dl>
        ) : null}

        {activeImg && (
          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Foto bukti{images.length > 1 ? ` (${activeIdx + 1}/${images.length})` : ""}
            </p>
            <img
              src={activeImg}
              alt="Bukti pelanggaran"
              className="max-h-[min(420px,58dvh)] max-w-full w-full rounded-lg border object-contain"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
            />
            {images.length > 1 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 touch-manipulation"
                    style={{ borderColor: i === activeIdx ? "var(--accent)" : "var(--border)" }}
                    aria-label={`Foto bukti ${i + 1}`}
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
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Pengakuan / tanda tangan
            </p>
            {isImageDataUrl(sig) ? (
              <img
                src={sig}
                alt="Tanda tangan siswa"
                className="max-h-40 max-w-full w-full rounded-lg border object-contain"
                style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
              />
            ) : (
              <p
                className="rounded-lg border p-3 text-xs whitespace-pre-wrap break-words"
                style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
              >
                {sig}
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
