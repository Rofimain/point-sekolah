"use client";

import { useRef, useState, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrisStyleSuccessSheet } from "@/components/QrisStyleSuccessSheet";
import { useStaffSubmissionNotifications } from "@/lib/use-staff-submission-notifications";
import {
  notificationSourceLabel,
  type StudentSubmissionNotification,
} from "@/lib/staff-submission-notifications";
import { formatIncidentDateOnly, formatInputDateTime } from "@/lib/utils";
import { Z_INDEX } from "@/lib/ui-layers";
import UserAvatar from "@/components/ui/UserAvatar";

export type { StudentSubmissionNotification };

function sheetDetails(it: StudentSubmissionNotification) {
  return [
    { label: "Siswa", value: it.studentName },
    ...(it.classLabel ? [{ label: "Kelas", value: it.classLabel }] : []),
    { label: "Pelanggaran", value: it.violationName },
    { label: "Poin", value: String(it.points) },
    { label: "Diinput oleh", value: notificationSourceLabel(it) },
    { label: "Tanggal kejadian", value: formatIncidentDateOnly(it.incidentDate) },
    { label: "Waktu input", value: formatInputDateTime(it.createdAt) },
  ];
}

function studentPhoto(it: StudentSubmissionNotification) {
  return (
    <UserAvatar
      name={it.studentName}
      userId={it.studentId}
      photoPresent={it.studentPhotoPresent}
      size="2xl"
      rounded="xl"
      className="mx-auto ring-2 ring-neutral-200"
    />
  );
}

export function StaffSubmissionBell() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sheetItem, setSheetItem] = useState<StudentSubmissionNotification | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const { items, readSet, readReady, unreadCount, markRead } = useStaffSubmissionNotifications();

  useEffect(() => setMounted(true), []);

  function placePanel() {
    const btn = buttonRef.current;
    if (!btn || typeof window === "undefined") return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const maxWidth = Math.min(22 * 16, window.innerWidth - margin * 2);
    // Prefer align to button right edge, but keep fully inside viewport.
    let left = rect.right - maxWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - maxWidth));
    const top = Math.min(rect.bottom + gap, window.innerHeight - margin - 120);
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width: maxWidth,
      zIndex: Z_INDEX.dropdown,
      maxHeight: "min(70dvh, 24rem)",
    });
  }

  useEffect(() => {
    if (!open) return;
    placePanel();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onReposition() {
      placePanel();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function handlePick(it: StudentSubmissionNotification) {
    markRead(it.id);
    setSheetItem(it);
    setOpen(false);
  }

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="overflow-hidden rounded-xl border shadow-lg"
            style={{
              ...panelStyle,
              background: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
            role="dialog"
            aria-label="Daftar catatan pelanggaran hari ini"
          >
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-2.5"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Catatan hari ini
              </span>
              <Link
                href="/notifications"
                className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-blue-600 hover:underline touch-manipulation"
                onClick={() => setOpen(false)}
              >
                Buka halaman
              </Link>
            </div>
            <ul className="max-h-[min(56dvh,20rem)] overflow-y-auto overscroll-contain p-1.5">
              {items.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Belum ada catatan pelanggaran hari ini.
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
                        <UserAvatar
                          name={it.studentName}
                          userId={it.studentId}
                          photoPresent={it.studentPhotoPresent}
                          size="lg"
                          rounded="lg"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{it.studentName}</span>
                          <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                            {it.violationName} · {it.points} poin
                          </span>
                          <span className="mt-0.5 block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {notificationSourceLabel(it)} · {formatInputDateTime(it.createdAt)}
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          className="relative flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg border text-sm transition-colors hover:opacity-80"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Notifikasi catatan pelanggaran"
          title="Notifikasi catatan pelanggaran"
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
      </div>

      {panel}

      <QrisStyleSuccessSheet
        open={sheetItem != null}
        onClose={() => setSheetItem(null)}
        title="Catatan masuk"
        subtitle={
          sheetItem?.submittedByStudent
            ? "Pelanggaran dari portal siswa telah masuk ke catatan."
            : "Pelanggaran yang diinput staf telah masuk ke catatan."
        }
        details={sheetItem ? sheetDetails(sheetItem) : []}
        headerMedia={sheetItem ? studentPhoto(sheetItem) : null}
        receiptRecordId={sheetItem?.id}
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
