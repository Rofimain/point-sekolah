"use client";

import { useEffect, useState, type ReactNode } from "react";

export function SectionAccordion({
  title,
  count,
  open,
  onToggle,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`card overflow-hidden shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-tertiary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
          {typeof count === "number" ? (
            <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>
              {count} jenis
            </span>
          ) : null}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Buka/tutup per section; saat forceOpenAll (mis. sedang cari) buka semua. */
export function useSectionAccordionState(sectionKeys: string[], forceOpenAll: boolean) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || sectionKeys.length === 0) return;
    setOpenMap({ [sectionKeys[0]]: true });
    setInitialized(true);
  }, [sectionKeys, initialized]);

  function isOpen(key: string): boolean {
    if (forceOpenAll) return true;
    return Boolean(openMap[key]);
  }

  function toggle(key: string) {
    if (forceOpenAll) return;
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return { isOpen, toggle };
}
