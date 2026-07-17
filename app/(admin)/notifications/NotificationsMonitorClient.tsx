"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrisStyleSuccessSheet } from "@/components/QrisStyleSuccessSheet";
import { useStaffSubmissionNotifications } from "@/lib/use-staff-submission-notifications";
import type { StudentSubmissionNotification } from "@/lib/staff-submission-notifications";
import { formatIncidentDateOnly, formatInputDateTime } from "@/lib/utils";

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

export default function NotificationsMonitorClient() {
  const router = useRouter();
  const { items, readSet, readReady, unreadCount, markRead, lastFetchedAt } =
    useStaffSubmissionNotifications();
  const [sheetItem, setSheetItem] = useState<StudentSubmissionNotification | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const visible = items.filter((it) => {
    const isRead = readSet.has(it.id);
    if (filter === "unread") return !isRead;
    if (filter === "read") return isRead;
    return true;
  });

  function handlePick(it: StudentSubmissionNotification) {
    markRead(it.id);
    setSheetItem(it);
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
            Monitoring Notifikasi
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Laporan dari portal siswa hari ini · diperbarui otomatis · hilang setelah berganti hari
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium"
            style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-muted)" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
            {lastFetchedAt ? (
              <span className="tabular-nums">
                · {lastFetchedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className="rounded-xl border p-4 text-left transition-opacity"
          style={{
            background: "var(--bg-secondary)",
            borderColor: filter === "all" ? "var(--accent)" : "var(--border)",
            borderWidth: filter === "all" ? 2 : 1,
          }}
        >
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Total hari ini
          </div>
          <div className="mt-1 font-serif text-2xl" style={{ color: "var(--text-primary)" }}>
            {readReady ? items.length : "—"}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className="rounded-xl border p-4 text-left transition-opacity"
          style={{
            background: "var(--bg-secondary)",
            borderColor: filter === "unread" ? "rgb(59 130 246)" : "var(--border)",
            borderWidth: filter === "unread" ? 2 : 1,
          }}
        >
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Belum dibaca
          </div>
          <div className="mt-1 font-serif text-2xl text-blue-600">
            {readReady ? unreadCount : "—"}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilter("read")}
          className="rounded-xl border p-4 text-left transition-opacity"
          style={{
            background: "var(--bg-secondary)",
            borderColor: filter === "read" ? "var(--border)" : "var(--border)",
            borderWidth: filter === "read" ? 2 : 1,
            opacity: filter === "read" ? 1 : undefined,
          }}
        >
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sudah dibaca
          </div>
          <div className="mt-1 font-serif text-2xl" style={{ color: "var(--text-secondary)" }}>
            {readReady ? items.length - unreadCount : "—"}
          </div>
        </button>
      </div>

      <div
        className="overflow-hidden rounded-xl border"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        {visible.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {items.length === 0
              ? "Belum ada laporan dari portal siswa hari ini."
              : "Tidak ada item pada filter ini."}
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {visible.map((it) => {
              const isRead = readSet.has(it.id);
              return (
                <li key={it.id} style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => handlePick(it)}
                    className="flex w-full gap-4 px-4 py-4 text-left transition hover:opacity-95 sm:px-5 sm:py-5"
                    style={{
                      background: isRead ? "transparent" : "rgba(59, 130, 246, 0.07)",
                    }}
                  >
                    <span
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                      style={{
                        background: isRead ? "var(--border)" : "rgb(59 130 246)",
                        boxShadow: isRead ? undefined : "0 0 0 3px rgba(59, 130, 246, 0.2)",
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-sm font-semibold sm:text-base"
                          style={{ color: isRead ? "var(--text-secondary)" : "var(--text-primary)" }}
                        >
                          {it.studentName}
                        </span>
                        {it.classLabel ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}
                          >
                            {it.classLabel}
                          </span>
                        ) : null}
                        {!isRead ? (
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                            Baru
                          </span>
                        ) : (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}
                          >
                            Dibaca
                          </span>
                        )}
                      </span>
                      <span
                        className="mt-1.5 block text-sm"
                        style={{ color: isRead ? "var(--text-muted)" : "var(--text-primary)" }}
                      >
                        {it.violationName}
                        <span className="mx-1.5" style={{ color: "var(--text-muted)" }}>
                          ·
                        </span>
                        <span className="font-semibold tabular-nums">{it.points} poin</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <span>Kejadian: {formatIncidentDateOnly(it.incidentDate)}</span>
                        <span>Input: {formatInputDateTime(it.createdAt)}</span>
                      </span>
                    </span>
                    <span
                      className="hidden shrink-0 self-center text-xs font-medium sm:inline"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Lihat detail →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <QrisStyleSuccessSheet
        open={sheetItem != null}
        onClose={() => setSheetItem(null)}
        title="Laporan diterima"
        subtitle="Pelanggaran dari portal siswa telah masuk ke catatan."
        details={sheetItem ? sheetDetails(sheetItem) : []}
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
    </div>
  );
}
