"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockAppScroll, Z_MODAL_ELEVATED_CLASS } from "@/lib/ui-layers";

export type QrisSuccessDetail = { label: string; value: string };

/**
 * Overlay sukses bergaya konfirmasi QRIS.
 * Tema mengikuti CSS variables (light/dark), bukan hardcoded putih.
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    return lockAppScroll();
  }, [open]);

  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_MODAL_ELEVATED_CLASS} flex items-end justify-center overflow-y-auto overscroll-contain p-0 sm:items-center sm:p-4`}
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
        className="relative z-10 my-auto w-full max-h-[min(90dvh,100%)] overflow-y-auto overscroll-contain sm:max-w-[360px] rounded-t-[1.35rem] border shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:rounded-2xl sm:shadow-2xl max-sm:animate-qris-sheet sm:animate-qris-modal"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-9 pb-2 text-center">
          {headerMedia ? (
            <div className="mx-auto mb-4 flex justify-center">{headerMedia}</div>
          ) : (
            <div
              className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-lg motion-safe:animate-qris-check"
              style={{
                background: "var(--success)",
                boxShadow: "0 10px 28px color-mix(in srgb, var(--success) 35%, transparent)",
              }}
            >
              <svg
                className="h-9 w-9 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          )}

          <h2
            id="qris-success-title"
            className="mt-5 text-[1.35rem] font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        </div>

        {details.length > 0 && (
          <div className="mx-5 mt-5 rounded-xl px-4 py-3 text-left" style={{ background: "var(--bg-primary)" }}>
            <div
              className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Rincian
            </div>
            <ul className="space-y-2.5">
              {details.map((row) => (
                <li key={row.label} className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                    {row.label}
                  </span>
                  <span className="min-w-0 break-words text-right font-medium" style={{ color: "var(--text-primary)" }}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2.5 p-5 pt-6 pb-sheet-bottom sm:pb-6">
          {receiptRecordId ? (
            <a
              href={`/api/records/${encodeURIComponent(receiptRecordId)}/evidence-pdf`}
              className="block min-h-11 w-full rounded-xl border-2 py-3 text-center text-[15px] font-semibold transition active:scale-[0.99] motion-reduce:transition-none"
              style={{
                borderColor: "var(--success)",
                background: "var(--bg-secondary)",
                color: "var(--success)",
              }}
            >
              Unduh bukti (.pdf)
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full touch-manipulation rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-md transition active:scale-[0.99] motion-reduce:transition-none"
            style={{
              background: "var(--success)",
              boxShadow: "0 8px 20px color-mix(in srgb, var(--success) 25%, transparent)",
            }}
          >
            Selesai
          </button>
          {afterPrimaryActions ? <div className="pt-1">{afterPrimaryActions}</div> : null}
          {receiptRecordId ? (
            <p className="pt-1 text-center text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              PDF dibuat secara aman dari catatan yang tersimpan dan hanya dapat diakses oleh pengguna yang berhak.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
