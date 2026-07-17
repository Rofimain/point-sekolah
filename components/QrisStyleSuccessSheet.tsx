"use client";

import { useEffect, type ReactNode } from "react";

export type QrisSuccessDetail = { label: string; value: string };

/**
 * Overlay sukses bergaya konfirmasi pembayaran QRIS (kartu, centang hijau, detail, tombol Selesai).
 */
export function QrisStyleSuccessSheet({
  open,
  onClose,
  title,
  subtitle,
  details = [],
  autoCloseMs = 0,
  afterPrimaryActions,
  receiptRecordId,
  headerMedia,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  details?: QrisSuccessDetail[];
  /** Tutup otomatis setelah N ms (0 = tidak auto). */
  autoCloseMs?: number;
  /** Konten tambahan di bawah tombol Selesai (mis. tautan sekunder). */
  afterPrimaryActions?: ReactNode;
  /** ID catatan untuk unduhan bukti PDF yang dibuat dan diotorisasi server. */
  receiptRecordId?: string;
  /** Opsional: foto siswa di atas judul (notifikasi laporan). */
  headerMedia?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto overscroll-contain p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qris-success-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/55 backdrop-blur-[3px] motion-safe:transition-opacity"
        onClick={onClose}
        aria-label="Tutup"
      />

      <div
        className="relative z-10 my-auto w-full max-h-[min(90dvh,100%)] overflow-y-auto overscroll-contain sm:max-w-[360px] rounded-t-[1.35rem] border border-neutral-200/80 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:rounded-2xl sm:shadow-2xl max-sm:animate-qris-sheet sm:animate-qris-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-9 pb-2 text-center">
          {headerMedia ? (
            <div className="mx-auto mb-4 flex justify-center">{headerMedia}</div>
          ) : (
            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/35 motion-safe:animate-qris-check">
              <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          )}

          <h2 id="qris-success-title" className="mt-5 text-[1.35rem] font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{subtitle}</p>
        </div>

        {details.length > 0 && (
          <div className="mx-5 mt-5 rounded-xl bg-neutral-50 px-4 py-3 text-left">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Rincian</div>
            <ul className="space-y-2.5">
              {details.map((row) => (
                <li key={row.label} className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-neutral-500">{row.label}</span>
                  <span className="min-w-0 text-right font-medium text-neutral-900">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2.5 p-5 pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-6">
          {receiptRecordId ? (
            <a
              href={`/api/records/${encodeURIComponent(receiptRecordId)}/evidence-pdf`}
              className="block w-full rounded-xl border-2 border-emerald-600 bg-white py-3 text-center text-[15px] font-semibold text-emerald-700 transition hover:bg-emerald-50 active:scale-[0.99] motion-reduce:transition-none"
            >
              Unduh bukti (.pdf)
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-[15px] font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.99] motion-reduce:transition-none"
          >
            Selesai
          </button>
          {afterPrimaryActions ? <div className="pt-1">{afterPrimaryActions}</div> : null}
          {receiptRecordId ? (
            <p className="pt-1 text-center text-[11px] text-neutral-400 leading-relaxed">
              PDF dibuat secara aman dari catatan yang tersimpan dan hanya dapat diakses oleh pengguna yang berhak.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
