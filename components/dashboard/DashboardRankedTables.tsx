"use client";

import { useMemo, useState } from "react";
import { PointBadge, StatusBadge, statusRank } from "@/components/PointThresholdBadges";

export type DashStudentRow = {
  id: string;
  name: string;
  className: string | null;
  total: number;
};

type SortKey = "name" | "class" | "points" | "status";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const OVER25_COLUMNS = [
  { key: "class", label: "Kelas", hiddenOnMobile: true },
  { key: "name", label: "Nama" },
  { key: "points", label: "Poin" },
] as const;

const TOP5_COLUMNS = [
  { key: "name", label: "Nama Siswa" },
  { key: "class", label: "Kelas", hiddenOnMobile: true },
  { key: "points", label: "Total Poin" },
  { key: "status", label: "Status" },
] as const;

export function sortDashboardRows(rows: DashStudentRow[], sort: SortState, criticalPoints: number, alertPoints = 50) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let compared = 0;
    if (sort.key === "points") compared = a.total - b.total;
    else if (sort.key === "status")
      compared = statusRank(a.total, alertPoints, criticalPoints) - statusRank(b.total, alertPoints, criticalPoints);
    else if (sort.key === "class") compared = (a.className ?? "").localeCompare(b.className ?? "", "id");
    else compared = a.name.localeCompare(b.name, "id");

    if (compared !== 0) return compared * direction;
    const byName = a.name.localeCompare(b.name, "id");
    return byName || a.id.localeCompare(b.id);
  });
}

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: { key: SortKey; label: string; hiddenOnMobile?: boolean };
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  return (
    <th
      className={`px-3 py-2 text-left sm:px-4 ${column.hiddenOnMobile ? "hidden sm:table-cell" : ""}`}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`inline-flex min-h-10 touch-manipulation items-center gap-1 rounded text-left transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] ${
          active ? "text-[var(--text-primary)]" : ""
        }`}
      >
        {column.label}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`}
          aria-hidden
        >
          {active ? (
            sort.direction === "asc" ? (
              <path d="M10 15V5M5 10l5-5 5 5" />
            ) : (
              <path d="M10 5v10M5 10l5 5 5-5" />
            )
          ) : (
            <path d="M7 8l3-3 3 3M7 12l3 3 3-3" />
          )}
        </svg>
      </button>
    </th>
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
  const [over25Sort, setOver25Sort] = useState<SortState>({ key: "points", direction: "desc" });
  const [top5Sort, setTop5Sort] = useState<SortState>({ key: "points", direction: "desc" });

  const sortedOver25 = useMemo(
    () => sortDashboardRows(over25, over25Sort, criticalPoints, alertPoints),
    [over25, over25Sort, criticalPoints, alertPoints]
  );
  const sortedTop5 = useMemo(
    () => sortDashboardRows(top5, top5Sort, criticalPoints, alertPoints),
    [top5, top5Sort, criticalPoints, alertPoints]
  );

  function nextSort(setter: (state: SortState) => void, current: SortState, key: SortKey) {
    setter({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" });
  }

  function renderCell(key: SortKey, row: DashStudentRow, showStatus: boolean) {
    if (key === "name") {
      return (
        <td key={key} className="px-3 text-sm font-medium sm:px-4" style={{ color: "var(--text-primary)" }}>
          {row.name}
        </td>
      );
    }
    if (key === "class") {
      return (
        <td
          key={key}
          className="hidden px-3 text-sm sm:table-cell sm:px-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {row.className || "—"}
        </td>
      );
    }
    if (key === "status" && showStatus) {
      return (
        <td key={key} className="px-3 sm:px-4">
          <StatusBadge points={row.total} alertPoints={alertPoints} criticalPoints={criticalPoints} />
        </td>
      );
    }
    return (
      <td key={key} className="px-3 sm:px-4">
        <PointBadge points={row.total} alertPoints={alertPoints} criticalPoints={criticalPoints} />
      </td>
    );
  }

  return (
    <>
      <div className="card mb-5 overflow-hidden">
        <div className="border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Siswa dengan poin efektif di atas {alertPoints}
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Berdasarkan poin setelah remisi periode tenang. Klik judul kolom untuk mengurutkan baris.
          </p>
        </div>
        {sortedOver25.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Tidak ada siswa di atas {alertPoints} poin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-elegant w-full min-w-[280px]">
              <thead>
                <tr>
                  {OVER25_COLUMNS.map((column) => (
                    <SortHeader
                      key={column.key}
                      column={column}
                      sort={over25Sort}
                      onSort={(key) => nextSort(setOver25Sort, over25Sort, key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOver25.map((row) => (
                  <tr key={row.id}>
                    {OVER25_COLUMNS.map(({ key }) => renderCell(key, row, false))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Siswa poin tertinggi (top 5)
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Klik judul kolom untuk mengurutkan baris.
          </p>
        </div>
        {sortedTop5.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Belum ada data poin siswa untuk ditampilkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-elegant w-full min-w-[300px]">
              <thead>
                <tr>
                  {TOP5_COLUMNS.map((column) => (
                    <SortHeader
                      key={column.key}
                      column={column}
                      sort={top5Sort}
                      onSort={(key) => nextSort(setTop5Sort, top5Sort, key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTop5.map((row) => (
                  <tr key={row.id}>
                    {TOP5_COLUMNS.map(({ key }) => renderCell(key, row, true))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
