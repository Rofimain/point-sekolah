"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QrisStyleSuccessSheet } from "@/components/QrisStyleSuccessSheet";
import {
  loadStaffSubmissionReadIds,
  persistStaffSubmissionReadIds,
  pruneStaffSubmissionReadIds,
} from "@/lib/staff-submission-reads";
import { formatIncidentDateOnly, formatInputDateTime } from "@/lib/utils";

const POLL_MS = 5000;
const POLL_HIDDEN_MS = 45000;

export type StudentSubmissionNotification = {
  id: string;
  studentName: string;
  classLabel: string | null;
  violationName: string;
  points: number;
  incidentDate: string;
  createdAt: string;
};

type ApiResponse = {
  revision: string;
  items: StudentSubmissionNotification[];
};

export function StaffSubmissionBell() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set());
  const [readReady, setReadReady] = useState(false);
  const [items, setItems] = useState<StudentSubmissionNotification[]>([]);
  const [sheetItem, setSheetItem] = useState<StudentSubmissionNotification | null>(null);

  useEffect(() => {
    setReadSet(loadStaffSubmissionReadIds());
    setReadReady(true);
  }, []);

  const markRead = useCallback((id: string) => {
    setReadSet((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistStaffSubmissionReadIds(next);
      return next;
    });
  }, []);

  const itemsKey = useMemo(() => items.map((i) => i.id).join(","), [items]);
  useEffect(() => {
    if (!itemsKey) return;
    const validIdSet = new Set(itemsKey.split(",").filter(Boolean));
    const pruned = pruneStaffSubmissionReadIds(validIdSet);
    setReadSet(pruned);
  }, [itemsKey]);

  const unreadCount = useMemo(
    () => (readReady ? items.filter((i) => !readSet.has(i.id)).length : 0),
    [items, readSet, readReady]
  );

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/staff/student-submissions-notifications", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ApiResponse;
        setItems(data.items);
      } catch {
        /* abaikan error jaringan sesekali */
      }
    }

    function clearTimer() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    function armTimer() {
      clearTimer();
      const ms = typeof document !== "undefined" && document.hidden ? POLL_HIDDEN_MS : POLL_MS;
      pollTimerRef.current = setInterval(poll, ms);
    }

    poll();
    armTimer();

    function onVisibility() {
      if (!document.hidden) poll();
      armTimer();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const el = panelRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function handlePick(it: StudentSubmissionNotification) {
    markRead(it.id);
    setSheetItem(it);
    setOpen(false);
  }

  function sheetDetails(it: StudentSubmissionNotification) {
    return [
      { label: "Siswa", value: it.studentName },
      ...(it.classLabel ? [{ label: "Kelas", value: it.classLabel }] : []),
      { label: "Pelanggaran", value: it.violationName },
      { label: "Poin", value: String(it.points) },
      { label: "Tanggal kejadian", value: formatIncidentDateOnly(it.incidentDate) },
      { label: "Waktu input", value: formatInputDateTime(it.createdAt) },
    ];
  }

  return (
    <>
      <div className="relative shrink-0" ref={panelRef}>
        <button
          type="button"
          className="relative flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border text-sm transition-colors hover:opacity-80 sm:h-8 sm:w-8"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Laporan dari siswa"
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {readReady && unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-[70] w-[min(100vw-1.5rem,22rem)] max-h-[min(70vh,24rem)] overflow-hidden rounded-xl border shadow-lg"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            role="dialog"
            aria-label="Daftar laporan dari siswa"
          >
            <div
              className="border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Laporan dari siswa
            </div>
            <ul className="max-h-[min(64vh,22rem)] overflow-y-auto overscroll-contain p-1.5">
              {items.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Belum ada laporan dari portal siswa.
                </li>
              ) : (
                items.map((it) => {
                  const isRead = readSet.has(it.id);
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="flex w-full gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition hover:opacity-95"
                        style={{
                          background: isRead ? "transparent" : "rgba(59, 130, 246, 0.08)",
                          color: "var(--text-primary)",
                        }}
                        onClick={() => handlePick(it)}
                      >
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: isRead ? "var(--border)" : "rgb(59 130 246)" }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{it.studentName}</span>
                          <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                            {it.violationName} · {it.points} poin
                          </span>
                          <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {formatInputDateTime(it.createdAt)}
                          </span>
                        </span>
                        {!isRead ? (
                          <span className="shrink-0 self-center text-[10px] font-medium uppercase text-blue-500">Baru</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      <QrisStyleSuccessSheet
        open={sheetItem != null}
        onClose={() => setSheetItem(null)}
        title="Laporan diterima"
        subtitle="Pelanggaran dari portal siswa telah masuk ke catatan."
        details={sheetItem ? sheetDetails(sheetItem) : []}
        afterPrimaryActions={
          <button
            type="button"
            className="w-full rounded-xl border py-2.5 text-[14px] font-semibold transition hover:opacity-90 active:scale-[0.99] motion-reduce:transition-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-secondary)",
            }}
            onClick={() => {
              setSheetItem(null);
              router.push("/records");
            }}
          >
            Buka halaman catatan
          </button>
        }
      />
    </>
  );
}
