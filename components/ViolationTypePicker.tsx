"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getViolationSectionLabel,
  groupByViolationSection,
  sortViolationSections,
  type ViolationBagianRow,
} from "@/lib/violation-sections";
import { splitViolationName, violationNameSortOrder } from "@/lib/violation-name";
import { SectionAccordion, useSectionAccordionState } from "@/components/SectionAccordion";

export type PickerViolationType = {
  id: string;
  name: string;
  points: number;
  category?: string;
  section?: string | null;
  description?: string | null;
  sortOrder?: number;
};

function matchesQuery(v: PickerViolationType, q: string, bagian: ViolationBagianRow[]): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const { code, title } = splitViolationName(v.name);
  const blob = [
    v.name,
    code,
    title,
    String(v.points),
    v.description ?? "",
    getViolationSectionLabel(v.section, bagian),
    v.section ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return t.split(/\s+/).filter(Boolean).every((p) => blob.includes(p));
}

export function ViolationTypePicker({
  violationTypes,
  bagian = [],
  value,
  onChange,
  required,
  placeholder = "— Pilih jenis pelanggaran —",
  label,
  id,
}: {
  violationTypes: PickerViolationType[];
  bagian?: ViolationBagianRow[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  placeholder?: string;
  label?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = violationTypes.find((v) => v.id === value);

  const sorted = useMemo(() => {
    return [...violationTypes].sort((a, b) => {
      const sec = sortViolationSections(a.section, b.section, bagian);
      if (sec !== 0) return sec;
      const byCode = violationNameSortOrder(a.name) - violationNameSortOrder(b.name);
      if (byCode !== 0) return byCode;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.points - b.points || a.name.localeCompare(b.name);
    });
  }, [violationTypes, bagian]);

  const filtered = useMemo(
    () => sorted.filter((v) => matchesQuery(v, q, bagian)),
    [sorted, q, bagian]
  );

  const grouped = useMemo(() => groupByViolationSection(filtered, bagian), [filtered, bagian]);
  const sectionKeys = useMemo(() => grouped.map((g) => g.section || "lainnya"), [grouped]);
  const { isOpen, toggle } = useSectionAccordionState(sectionKeys, Boolean(q.trim()));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (listRef.current) listRef.current.scrollTop = 0;
    } else {
      setQ("");
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
          {required ? " *" : ""}
        </label>
      ) : null}

      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm"
        style={{
          background: "var(--bg-primary)",
          borderColor: open ? "var(--accent)" : "var(--border)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)" : undefined,
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-medium">{selected.name}</span>
              <span className="mt-0.5 block truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                {getViolationSectionLabel(selected.section, bagian)} · {selected.points} poin
              </span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="shrink-0 text-xs opacity-60">{open ? "▲" : "▼"}</span>
      </button>

      {required ? <input tabIndex={-1} className="sr-only" required value={value} onChange={() => {}} /> : null}

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-xl border shadow-lg"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
            maxHeight: "min(24rem, 70vh)",
          }}
          role="listbox"
        >
          <div className="border-b p-2" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari no / nama pelanggaran…"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div ref={listRef} className="max-h-[min(18rem,55vh)] space-y-1 overflow-y-auto overscroll-contain p-1.5">
            {value ? (
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-xs"
                style={{ color: "var(--text-muted)" }}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                — Kosongkan pilihan —
              </button>
            ) : null}

            {!grouped.length ? (
              <p className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Tidak ada hasil untuk &quot;{q.trim()}&quot;
              </p>
            ) : (
              grouped.map(({ section, items }) => {
                const key = section || "lainnya";
                return (
                  <SectionAccordion
                    key={key}
                    title={getViolationSectionLabel(section, bagian)}
                    count={items.length}
                    open={isOpen(key)}
                    onToggle={() => toggle(key)}
                    className="rounded-lg"
                  >
                    {items.map((v) => {
                      const { code, title } = splitViolationName(v.name);
                      const active = v.id === value;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors"
                          style={{
                            background: active ? "var(--accent-light)" : "transparent",
                            color: "var(--text-primary)",
                          }}
                          onClick={() => {
                            onChange(v.id);
                            setOpen(false);
                          }}
                        >
                          <span
                            className="w-10 shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {code || "—"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium leading-snug">{title || v.name}</span>
                            <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {v.points} poin
                              {v.description ? ` · ${v.description}` : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </SectionAccordion>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
