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
      className={`overflow-hidden rounded-xl border ${className}`}
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:opacity-95"
        style={{ background: "var(--bg-primary)" }}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span
            className="block text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            {title}
          </span>
          {typeof count === "number" ? (
            <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-muted)" }}>
              {count} jenis
            </span>
          ) : null}
        </span>
        <span
          className="shrink-0 text-xs tabular-nums transition-transform"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          ▼
        </span>
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
