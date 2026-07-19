import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { formatPointAdjustmentReason } from "@/lib/point-adjustment-reason";

export type StudentPointsDetailViewProps = {
  studentName: string;
  nisn: string | null;
  classNameLabel: string | null;
  quietDays: number;
  breakdown: {
    gross: number;
    adjustmentSum: number;
    effective: number;
  };
  history: {
    records: { id: string; date: Date; violationName: string; points: number; notes: string | null }[];
    adjustments: { id: string; createdAt: Date; pointsDelta: number; reason: string; grossTotalBefore: number }[];
  };
  backHref?: string;
  cetakHref?: string;
};

export function StudentPointsDetailView({
  studentName,
  nisn,
  classNameLabel,
  quietDays,
  breakdown,
  history,
  backHref = "/students",
  cetakHref,
}: StudentPointsDetailViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium hover:underline"
          style={{ color: "var(--accent)" }}
        >
          ← Kembali ke daftar siswa
        </Link>
        {cetakHref ? (
          <Link
            href={cetakHref}
            className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border px-3 text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-primary)" }}
          >
            Cetak surat
          </Link>
        ) : null}
      </div>

      <header
        className="rounded-xl border px-4 py-4 sm:px-5"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Info poin siswa
        </p>
        <h1 className="mt-1 text-xl font-bold break-words" style={{ color: "var(--text-primary)" }}>
          {studentName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {[classNameLabel, nisn ? `NISN ${nisn}` : null].filter(Boolean).join(" · ") || "—"}
        </p>
      </header>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Ringkasan poin
        </h2>
        <div className="mt-3 flex flex-wrap gap-6 items-baseline">
          <div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Total dari catatan
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {breakdown.gross}
            </div>
          </div>
          {breakdown.adjustmentSum !== 0 ? (
            <div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Penyesuaian / remisi
              </div>
              <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {breakdown.adjustmentSum}
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Poin efektif
            </div>
            <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--danger)" }}>
              {breakdown.effective}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Remisi otomatis periode tenang dapat diterapkan setelah ≥{quietDays} hari sejak tanggal kejadian pelanggaran
          terakhir (dari tanggal kejadian, bukan tanggal input).
        </p>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Riwayat pelanggaran
        </h2>
        {history.records.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Tidak ada catatan pelanggaran.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr style={{ background: "var(--bg-primary)" }}>
                  <th
                    className="px-3 py-2 text-left text-[11px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Tanggal
                  </th>
                  <th
                    className="px-3 py-2 text-left text-[11px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Pelanggaran
                  </th>
                  <th
                    className="px-3 py-2 text-right text-[11px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Poin
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.records.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(r.date)}
                    </td>
                    <td className="px-3 py-2 break-words" style={{ color: "var(--text-primary)" }}>
                      {r.violationName}
                      {r.notes ? (
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {r.notes}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular-nums font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {r.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Riwayat remisi / penyesuaian
        </h2>
        {history.adjustments.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Tidak ada remisi atau penyesuaian poin.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr style={{ background: "var(--bg-primary)" }}>
                  <th
                    className="px-3 py-2 text-left text-[11px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Tanggal
                  </th>
                  <th
                    className="px-3 py-2 text-left text-[11px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Keterangan
                  </th>
                  <th
                    className="px-3 py-2 text-right text-[11px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Δ Poin
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.adjustments.map((a) => (
                  <tr key={a.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(a.createdAt)}
                    </td>
                    <td className="px-3 py-2 break-words" style={{ color: "var(--text-primary)" }}>
                      {formatPointAdjustmentReason(a.reason)}
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular-nums font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.pointsDelta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
