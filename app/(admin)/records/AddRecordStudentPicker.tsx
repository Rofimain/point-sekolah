"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { getInitials } from "@/lib/utils";

export type PickerStudent = {
  id: string;
  name: string;
  nisn: string | null;
  class: { name: string; grade: string } | null;
};

function totalBadgeStyle(pts: number): [string, string] {
  if (pts >= 75) return ["var(--danger-bg)", "var(--danger)"];
  if (pts >= 50) return ["var(--warning-bg)", "var(--warning)"];
  if (pts > 0) return ["var(--accent-light)", "var(--accent)"];
  return ["var(--bg-tertiary)", "var(--text-muted)"];
}

export function AddRecordStudentPicker({
  students,
  value,
  onChange,
  totalPointsMap,
}: {
  students: PickerStudent[];
  value: string;
  onChange: (studentId: string) => void;
  totalPointsMap: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = students.find((s) => s.id === value);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;
    const parts = t.split(/\s+/).filter(Boolean);
    return students.filter((s) => {
      const blob = [s.name, s.nisn ?? "", s.class?.name ?? "", s.class?.grade ?? ""].join(" ").toLowerCase();
      return parts.every((p) => blob.includes(p));
    });
  }, [students, q]);

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
    if (open && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [open, q]);

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        Pilih siswa
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-shadow"
        style={{
          background: "var(--bg-primary)",
          borderColor: open ? "var(--accent)" : "var(--border)",
          boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)" : undefined,
        }}
      >
        {selected ? (
          <>
            <span
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--accent) 0%, #1A2340 100%)" }}
            >
              {getInitials(selected.name)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {selected.name}
              </span>
              <span className="block text-[11px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                {selected.class ? `${selected.class.grade} · ${selected.class.name}` : "Belum ada kelas"}
                {selected.nisn ? ` · NISN ${selected.nisn}` : ""}
              </span>
            </span>
            {(() => {
              const pts = totalPointsMap[selected.id] ?? 0;
              const [bg, fg] = totalBadgeStyle(pts);
              return (
                <span className="flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: bg, color: fg }}>
                  {pts} poin
                </span>
              );
            })()}
          </>
        ) : (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Ketuk untuk memilih siswa…
          </span>
        )}
        <span className="flex-shrink-0 text-xs opacity-60" style={{ color: "var(--text-secondary)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-[70] rounded-xl border overflow-hidden flex flex-col shadow-lg"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
            boxShadow: "0 16px 48px var(--shadow)",
            maxHeight: "min(22rem, 70vh)",
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, NISN, kelas, atau angkatan…"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <p className="text-[10px] mt-1.5 px-1" style={{ color: "var(--text-muted)" }}>
              {filtered.length} dari {students.length} siswa aktif
            </p>
          </div>
          <ul ref={listRef} className="overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Tidak ada siswa yang cocok. Ubah kata kunci pencarian.
              </li>
            ) : (
              filtered.map((s) => {
                const active = s.id === value;
                const pts = totalPointsMap[s.id] ?? 0;
                const [bg, fg] = totalBadgeStyle(pts);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(s.id);
                        setOpen(false);
                        setQ("");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                      style={{
                        background: active ? "var(--accent-light)" : "transparent",
                        borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tertiary)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <span
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: active ? "var(--accent)" : "linear-gradient(135deg, #4A5A8A 0%, #1A2340 100%)" }}
                      >
                        {getInitials(s.name)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {s.name}
                        </span>
                        <span className="block text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {s.class ? `${s.class.grade} ${s.class.name}` : "Tanpa kelas"}
                          {s.nisn ? ` · NISN ${s.nisn}` : " · NISN belum diisi"}
                        </span>
                      </span>
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums" style={{ background: bg, color: fg }}>
                        {pts}p
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
