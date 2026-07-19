"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QrisStyleSuccessSheet } from "@/components/QrisStyleSuccessSheet";
import { useStaffSubmissionNotifications } from "@/lib/use-staff-submission-notifications";
import { notificationSourceLabel, type StudentSubmissionNotification } from "@/lib/staff-submission-notifications";
import { formatIncidentDateOnly, formatInputDateTime } from "@/lib/utils";
import { Z_INDEX } from "@/lib/ui-layers";
import UserAvatar from "@/components/ui/UserAvatar";

export type { StudentSubmissionNotification };

const PANEL_MARGIN = 12;
const PANEL_GAP = 6;
const PANEL_MAX_WIDTH_PX = 22 * 16; // 22rem
/** Cadangan tinggi minimum agar panel tidak menempel ujung bawah layar. */
const PANEL_BOTTOM_RESERVE = 120;

type PanelBox = {
  top: number;
  left: number;
  width: number;
};

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

function readViewport() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetLeft: vv?.offsetLeft ?? 0,
    offsetTop: vv?.offsetTop ?? 0,
  };
}

function computePanelBox(button: HTMLElement): PanelBox {
  const rect = button.getBoundingClientRect();
  const { width: vw, height: vh, offsetLeft, offsetTop } = readViewport();
  const width = Math.min(PANEL_MAX_WIDTH_PX, vw - PANEL_MARGIN * 2);
  const minLeft = offsetLeft + PANEL_MARGIN;
  const maxLeft = offsetLeft + vw - PANEL_MARGIN - width;
  // Prefer align ke tepi kanan tombol, lalu clamp agar tidak keluar kiri/kanan.
  const left = Math.max(minLeft, Math.min(rect.right - width, maxLeft));
  const preferredTop = rect.bottom + PANEL_GAP;
  const maxTop = offsetTop + vh - PANEL_MARGIN - PANEL_BOTTOM_RESERVE;
  const top = Math.max(offsetTop + PANEL_MARGIN, Math.min(preferredTop, maxTop));
  return { top, left, width };
}

export function StaffSubmissionBell() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sheetItem, setSheetItem] = useState<StudentSubmissionNotification | null>(null);
  /** null sampai posisi dihitung — mencegah flash di (0,0) sebelum layout. */
  const [panelBox, setPanelBox] = useState<PanelBox | null>(null);
  const { items, readSet, readReady, unreadCount, markRead } = useStaffSubmissionNotifications();

  useEffect(() => setMounted(true), []);

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    setPanelBox(computePanelBox(btn));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelBox(null);
      return;
    }
    updatePanelPosition();

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onReposition() {
      updatePanelPosition();
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("orientationchange", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.visualViewport?.addEventListener("resize", onReposition);
    window.visualViewport?.addEventListener("scroll", onReposition);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("orientationchange", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.visualViewport?.removeEventListener("resize", onReposition);
      window.visualViewport?.removeEventListener("scroll", onReposition);
    };
  }, [open, updatePanelPosition]);

  function handlePick(it: StudentSubmissionNotification) {
    markRead(it.id);
    setSheetItem(it);
    setOpen(false);
  }

  const showPanel = mounted && open && panelBox != null;

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
          <svg
            className="h-[18px] w-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
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

      {showPanel
        ? createPortal(
            <div
              ref={panelRef}
              className="overflow-hidden rounded-xl border shadow-lg"
              style={{
                position: "fixed",
                top: panelBox.top,
                left: panelBox.left,
                width: panelBox.width,
                // Z_INDEX.dropdown (70) > TopBar (60) — lihat lib/ui-layers.ts
                zIndex: Z_INDEX.dropdown,
                maxHeight: "min(70dvh, 24rem)",
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
                <span
                  className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
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
                            <span className="shrink-0 self-center text-[10px] font-medium uppercase text-blue-500">
                              Baru
                            </span>
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
        : null}

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
            className="min-h-11 w-full rounded-xl border py-2.5 text-[14px] font-semibold transition hover:opacity-90 active:scale-[0.99] motion-reduce:transition-none"
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
