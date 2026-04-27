"use client";

import { useEffect } from "react";
import { downloadViolationReceiptHtml } from "@/lib/download-violation-receipt-html";

export type QrisSuccessDetail = { label: string; value: string };

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME || "Sekolah";

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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  details?: QrisSuccessDetail[];
  /** Tutup otomatis setelah N ms (0 = tidak auto). */
  autoCloseMs?: number;
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

  function handleDownload() {
    downloadViolationReceiptHtml({
      schoolName: SCHOOL_NAME,
      title,
      subtitle,
      details,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex max-sm:items-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qris-success-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px] motion-safe:transition-opacity"
        onClick={onClose}
        aria-label="Tutup"
      />

      <div
        className="relative z-10 w-full max-sm:max-h-[88vh] max-sm:overflow-y-auto sm:max-w-[360px] rounded-t-[1.35rem] border border-neutral-200/80 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:rounded-2xl sm:shadow-2xl max-sm:animate-qris-sheet sm:animate-qris-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-9 pb-2 text-center">
          <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/35 motion-safe:animate-qris-check">
            <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

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

        <div className="p-5 pt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleDownload}
            className="w-full rounded-xl border-2 border-emerald-600 bg-white py-3 text-[15px] font-semibold text-emerald-700 transition hover:bg-emerald-50 active:scale-[0.99] motion-reduce:transition-none"
          >
            Unduh bukti (.html)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-[15px] font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.99] motion-reduce:transition-none"
          >
            Selesai
          </button>
          <p className="pt-1 text-center text-[11px] text-neutral-400 leading-relaxed">
            File HTML bisa dibuka di HP/komputer; untuk PDF gunakan buka file → Cetak → Simpan sebagai PDF. Tangkapan layar juga tetap boleh.
          </p>
        </div>
      </div>
    </div>
  );
}
