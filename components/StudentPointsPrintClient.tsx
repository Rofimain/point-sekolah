"use client";

import { useState } from "react";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import {
  StudentPointsPrintArticle,
  type StudentPointsPrintArticleProps,
} from "@/components/StudentPointsPrintArticle";

type Props = Omit<StudentPointsPrintArticleProps, "print"> & {
  redaksi: string;
  backHref?: string;
  backLabel?: string;
};

export function StudentPointsPrintClient({
  redaksi,
  backHref = "/students",
  backLabel = "← Kembali ke daftar siswa",
  ...articleProps
}: Props) {
  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorTitle, setCoordinatorTitle] = useState("");

  return (
    <div className="pb-safe-bottom">
      <div className="no-print mb-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={backHref} className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            {backLabel}
          </Link>
          <PrintButton />
        </div>

        <div
          className="rounded-xl border p-4 space-y-3 max-w-xl"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Tanda tangan cetak
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Isi nama dan jabatan sebelum mencetak. Kosongkan jika ingin garis tanda tangan kosong.
          </p>
          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Nama
            </label>
            <input
              value={coordinatorName}
              onChange={(e) => setCoordinatorName(e.target.value)}
              placeholder="mis. Drs. Hartanto"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Jabatan
            </label>
            <input
              value={coordinatorTitle}
              onChange={(e) => setCoordinatorTitle(e.target.value)}
              placeholder="mis. Koordinator BP/BK"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>
      </div>

      <StudentPointsPrintArticle
        {...articleProps}
        print={{
          redaksi,
          coordinatorName: coordinatorName.trim() || "_______________________",
          coordinatorTitle: coordinatorTitle.trim(),
        }}
      />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
