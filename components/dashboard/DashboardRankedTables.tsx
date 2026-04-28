"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type DashStudentRow = {
  id: string;
  name: string;
  className: string | null;
  total: number;
};

const LS_OVER25 = "dashboard:over25:colOrder";
const LS_TOP5 = "dashboard:top5:colOrder";

const OVER25_KEYS = ["name", "class", "points"] as const;
const TOP5_KEYS = ["name", "class", "points", "status"] as const;

type Over25Key = (typeof OVER25_KEYS)[number];
type Top5Key = (typeof TOP5_KEYS)[number];

const OVER25_LABELS: Record<Over25Key, string> = {
  name: "Nama",
  class: "Kelas",
  points: "Poin",
};
const TOP5_LABELS: Record<Top5Key, string> = {
  name: "Nama Siswa",
  class: "Kelas",
  points: "Total Poin",
  status: "Status",
};

function parseOrder<T extends string>(raw: string | null, valid: readonly T[], fallback: T[]): T[] {
  if (!raw) return [...fallback];
  const allowed = new Set<string>(valid as unknown as string[]);
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...fallback];
    const seen = new Set<T>();
    const out: T[] = [];
    for (const k of arr) {
      const s = typeof k === "string" ? k : "";
      if (allowed.has(s) && !seen.has(s as T)) {
        seen.add(s as T);
        out.push(s as T);
      }
    }
    for (const k of valid) {
      if (!seen.has(k)) out.push(k);
    }
    return out.length === valid.length ? out : [...fallback];
  } catch {
    return [...fallback];
  }
}

function PointBadge({ points }: { points: number }) {
  const c =
    points >= 75
      ? (["var(--danger-bg)", "var(--danger)"] as const)
      : points >= 50
        ? (["var(--warning-bg)", "var(--warning)"] as const)
        : (["var(--success-bg)", "var(--success)"] as const);
  return (
    <span className="inline-flex h-5 w-9 items-center justify-center rounded-full text-xs font-bold" style={{ background: c[0], color: c[1] }}>
      {points}
    </span>
  );
}

function StatusBadge({ points, criticalPoints }: { points: number; criticalPoints: number }) {
  const s =
    points >= criticalPoints
      ? (["var(--danger-bg)", "var(--danger)", "Kritis"] as const)
      : points >= 50
        ? (["var(--warning-bg)", "var(--warning)", "Perhatian"] as const)
        : (["var(--success-bg)", "var(--success)", "Normal"] as const);
  return (
    <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: s[0], color: s[1] }}>
      {s[2]}
    </span>
  );
}

function move<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

function ColumnOrderControls<T extends string>({
  order,
  onChange,
  labels,
}: {
  order: T[];
  onChange: (next: T[]) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Urutan kolom
      </span>
      <div className="flex flex-wrap gap-1.5">
        {order.map((key, i) => (
          <span
            key={key}
            className="inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
          >
            <span className="max-w-[5.5rem] truncate">{labels[key]}</span>
            <button
              type="button"
              className="touch-manipulation rounded px-0.5 disabled:opacity-30"
              style={{ color: "var(--accent)" }}
              disabled={i === 0}
              aria-label={`Naikkan ${labels[key]}`}
              onClick={() => onChange(move(order, i, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              className="touch-manipulation rounded px-0.5 disabled:opacity-30"
              style={{ color: "var(--accent)" }}
              disabled={i === order.length - 1}
              aria-label={`Turunkan ${labels[key]}`}
              onClick={() => onChange(move(order, i, 1))}
            >
              ↓
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardRankedTables({
  over25,
  top5,
  alertPoints,
  criticalPoints,
}: {
  over25: DashStudentRow[];
  top5: DashStudentRow[];
  alertPoints: number;
  criticalPoints: number;
}) {
  const defaultOver25 = useMemo(() => [...OVER25_KEYS] as Over25Key[], []);
  const defaultTop5 = useMemo(() => [...TOP5_KEYS] as Top5Key[], []);

  const [over25Order, setOver25Order] = useState<Over25Key[]>(defaultOver25);
  const [top5Order, setTop5Order] = useState<Top5Key[]>(defaultTop5);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setOver25Order(parseOrder(localStorage.getItem(LS_OVER25), OVER25_KEYS, defaultOver25));
    setTop5Order(parseOrder(localStorage.getItem(LS_TOP5), TOP5_KEYS, defaultTop5));
    setMounted(true);
  }, [defaultOver25, defaultTop5]);

  const persistOver25 = useCallback((next: Over25Key[]) => {
    setOver25Order(next);
    localStorage.setItem(LS_OVER25, JSON.stringify(next));
  }, []);

  const persistTop5 = useCallback((next: Top5Key[]) => {
    setTop5Order(next);
    localStorage.setItem(LS_TOP5, JSON.stringify(next));
  }, []);

  function renderOver25Cell(key: Over25Key, row: DashStudentRow) {
    if (key === "name") {
      return (
        <td key={key} className="px-3 py-2.5 text-xs font-medium sm:px-4" style={{ color: "var(--text-primary)" }}>
          {row.name}
        </td>
      );
    }
    if (key === "class") {
      return (
        <td
          key={key}
          className="hidden px-3 py-2.5 text-xs sm:table-cell sm:px-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {row.className || "—"}
        </td>
      );
    }
    return (
      <td key={key} className="px-3 py-2.5 sm:px-4">
        <PointBadge points={row.total} />
      </td>
    );
  }

  function renderTop5Cell(key: Top5Key, row: DashStudentRow) {
    if (key === "name") {
      return (
        <td key={key} className="px-3 py-3 text-xs sm:px-4" style={{ color: "var(--text-primary)" }}>
          {row.name}
        </td>
      );
    }
    if (key === "class") {
      return (
        <td
          key={key}
          className="hidden px-3 py-3 text-xs sm:table-cell sm:px-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {row.className || "—"}
        </td>
      );
    }
    if (key === "points") {
      return (
        <td key={key} className="px-3 py-3 sm:px-4">
          <PointBadge points={row.total} />
        </td>
      );
    }
    return (
      <td key={key} className="px-3 py-3 sm:px-4">
        <StatusBadge points={row.total} criticalPoints={criticalPoints} />
      </td>
    );
  }

  if (!mounted) {
    return (
      <div className="space-y-5">
        <div className="h-40 animate-pulse rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }} />
        <div className="h-40 animate-pulse rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }} />
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 overflow-hidden rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="border-b px-3 py-3 sm:px-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
            Siswa dengan poin efektif di atas {alertPoints}
          </h2>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Berdasarkan poin setelah remisi periode tenang (jika ada). Urutan kolom tersimpan di perangkat ini.
          </p>
          <ColumnOrderControls order={over25Order} onChange={persistOver25} labels={OVER25_LABELS} />
        </div>
        {over25.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Tidak ada siswa di atas {alertPoints} poin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px]">
              <thead>
                <tr style={{ background: "var(--bg-primary)" }}>
                  {over25Order.map((key) => (
                    <th
                      key={key}
                      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide sm:px-4 ${
                        key === "class" ? "hidden sm:table-cell" : ""
                      }`}
                      style={{ color: "var(--text-muted)" }}
                    >
                      {OVER25_LABELS[key]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {over25.map((row) => (
                  <tr key={row.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    {over25Order.map((key) => renderOver25Cell(key, row))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex flex-col gap-1 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-sm font-serif" style={{ color: "var(--text-primary)" }}>
              Siswa poin tertinggi (top 5)
            </h2>
            <ColumnOrderControls order={top5Order} onChange={persistTop5} labels={TOP5_LABELS} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px]">
            <thead>
              <tr style={{ background: "var(--bg-primary)" }}>
                {top5Order.map((key) => (
                  <th
                    key={key}
                    className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide sm:px-4 ${
                      key === "class" ? "hidden sm:table-cell" : ""
                    }`}
                    style={{ color: "var(--text-muted)" }}
                  >
                    {TOP5_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top5.map((row) => (
                <tr key={row.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  {top5Order.map((key) => renderTop5Cell(key, row))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
