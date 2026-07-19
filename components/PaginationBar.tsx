"use client";

import type { CSSProperties } from "react";
import { visiblePageNumbers } from "@/lib/pagination";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Teks kiri, default "Halaman X / Y" */
  label?: string;
};

export function PaginationBar({ page, totalPages, onPageChange, label }: Props) {
  if (totalPages <= 1) return null;

  const pages = visiblePageNumbers(page, totalPages);
  const text = label ?? `Halaman ${page} / ${totalPages}`;

  function btnStyle(active: boolean, disabled?: boolean): CSSProperties {
    return {
      background: active ? "var(--accent)" : "var(--bg-primary)",
      color: active ? "white" : "var(--text-secondary)",
      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      opacity: disabled ? 0.4 : 1,
    };
  }

  return (
    <div
      className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
      style={{ borderColor: "var(--border)" }}
    >
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {text}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded px-2 text-xs font-semibold disabled:cursor-not-allowed"
          style={btnStyle(false, page <= 1)}
        >
          ‹
        </button>
        {pages[0] > 1 ? (
          <>
            <button
              type="button"
              aria-label="Halaman 1"
              onClick={() => onPageChange(1)}
              className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded text-xs"
              style={btnStyle(false)}
            >
              1
            </button>
            {pages[0] > 2 ? (
              <span className="px-1 text-xs" style={{ color: "var(--text-muted)" }} aria-hidden>
                …
              </span>
            ) : null}
          </>
        ) : null}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            aria-label={`Halaman ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded text-xs"
            style={btnStyle(p === page)}
          >
            {p}
          </button>
        ))}
        {pages[pages.length - 1]! < totalPages ? (
          <>
            {pages[pages.length - 1]! < totalPages - 1 ? (
              <span className="px-1 text-xs" style={{ color: "var(--text-muted)" }} aria-hidden>
                …
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`Halaman ${totalPages}`}
              onClick={() => onPageChange(totalPages)}
              className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded text-xs"
              style={btnStyle(false)}
            >
              {totalPages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-11 min-w-11 touch-manipulation items-center justify-center rounded px-2 text-xs font-semibold disabled:cursor-not-allowed"
          style={btnStyle(false, page >= totalPages)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
