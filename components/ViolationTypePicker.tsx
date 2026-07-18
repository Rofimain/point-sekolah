"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  VIOLATION_SECTIONS,
  getViolationSectionLabel,
  sortViolationSections,
} from "@/lib/violation-sections";
import { splitViolationName, violationNameSortOrder } from "@/lib/violation-name";

export type PickerViolationType = {
  id: string;
  name: string;
  points: number;
  category?: string;
  section?: string | null;
  description?: string | null;
  sortOrder?: number;
};

function matchesQuery(v: PickerViolationType, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const { code, title } = splitViolationName(v.name);
  const blob = [
    v.name,
    code,
    title,
    String(v.points),
    v.description ?? "",
    getViolationSectionLabel(v.section),
    v.section ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return t.split(/\s+/).filter(Boolean).every((p) => blob.includes(p));
}

export function ViolationTypePicker({
  violationTypes,
  value,
  onChange,
  required,
  placeholder = "— Pilih jenis pelanggaran —",
  label,
  id,
}: {
  violationTypes: PickerViolationType[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Jika diisi, render label di atas kontrol. Kosongkan jika label sudah di luar. */
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
      const sec = sortViolationSections(a.section, b.section);
      if (sec !== 0) return sec;
      const byCode = violationNameSortOrder(a.name) - violationNameSortOrder(b.name);
      if (byCode !== 0) return byCode;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.points - b.points || a.name.localeCompare(b.name);
    });
  }, [violationTypes]);

  const filtered = useMemo(() => sorted.filter((v) => matchesQuery(v, q)), [sorted, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, PickerViolationType[]>();
    for (const v of filtered) {
      const key = v.section || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    const keys = [
      ...VIOLATION_SECTIONS.filter((s) => map.has(s)),
      ...[...map.keys()].filter((k) => !(VIOLATION_SECTIONS as readonly string[]).includes(k)),
    ];
    return keys.map((section) => ({ section, items: map.get(section)! }));
  }, [filtered]);

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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
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

  const selectedParts = selected ? splitViolationName(selected.name) : null;

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
          {required ? " *" : ""}
        </label>
      ) : null}

      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="font-medium">
                {selectedParts?.code ? (
                  <>
                    <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      [{selectedParts.code}]
                    </span>{" "}
                    {selectedParts.title}
                  </>
                ) : (
                  selected.name
                )}
              </span>
              <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-muted)" }}>
                {getViolationSectionLabel(selected.section)} · {selected.points} poin
              </span>
            </>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>{placeholder}</span>
          )}
        </span>
        <span className="shrink-0 text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Hidden input for native form required validation */}
      {required ? (
        <input
          tabIndex={-1}
          className="sr-only"
          value={value}
          required
          onChange={() => {}}
          aria-hidden
        />
      ) : null}

      {open && (
        <div
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border shadow-lg"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          role="listbox"
        >
          <div className="flex gap-2 border-b p-2" style={{ borderColor: "var(--border)" }}>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari no / nama / poin…"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white"
              style={{ background: "var(--accent)" }}
              onClick={() => inputRef.current?.focus()}
            >
              Cari
            </button>
          </div>

          <div ref={listRef} className="max-h-[min(16rem,50dvh)] overflow-y-auto overscroll-contain py-1">
            {value ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs"
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
              grouped.map(({ section, items }) => (
                <div key={section || "lainnya"}>
                  <div
                    className="sticky top-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}
                  >
                    {getViolationSectionLabel(section)}
                  </div>
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
