import { formatDate } from "@/lib/utils";
import { formatPointAdjustmentReason } from "@/lib/point-adjustment-reason";

export type StudentPointsPrintArticleProps = {
  studentName: string;
  nisn: string | null;
  classNameLabel: string | null;
  issued: Date;
  print: {
    redaksi: string;
    coordinatorName: string;
    coordinatorTitle: string;
  };
  breakdown: {
    gross: number;
    adjustmentSum: number;
    effective: number;
  };
  quietDays?: number;
  history: {
    records: { id: string; date: Date; violationName: string; points: number; notes: string | null }[];
    adjustments: { id: string; createdAt: Date; pointsDelta: number; reason: string; grossTotalBefore: number }[];
  };
};

export function StudentPointsPrintArticle({
  studentName,
  nisn,
  classNameLabel,
  issued,
  print,
  breakdown,
  quietDays = 30,
  history,
}: StudentPointsPrintArticleProps) {
  return (
    <div className="space-y-6 print:space-y-0">
      {/* Halaman 1 */}
      <article
        className="rounded-xl border bg-white p-4 text-black shadow-sm sm:p-8 print:border-0 print:shadow-none"
        style={{ borderColor: "var(--border)" }}
      >
        <header className="text-center border-b border-neutral-300 pb-4 mb-6">
          <h1 className="text-lg font-bold tracking-tight">SURAT KETERANGAN POIN PELANGGARAN</h1>
          {/* sesuai permintaan: hapus \"— dicetak dari aplikasi resmi\" */}
          <p className="text-sm mt-1 text-neutral-600">Sistem Tata Tertib Sekolah</p>
        </header>

        <p className="text-sm leading-relaxed mb-6 text-justify">{print.redaksi}</p>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8">
          <div>
            <dt className="text-neutral-500 text-xs uppercase">Nama siswa</dt>
            <dd className="font-semibold">{studentName}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 text-xs uppercase">NISN</dt>
            <dd>{nisn ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 text-xs uppercase">Kelas</dt>
            <dd>{classNameLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 text-xs uppercase">Tanggal cetak</dt>
            <dd>{formatDate(issued)}</dd>
          </div>
        </dl>

        <div className="rounded-lg border border-neutral-200 p-4 mb-8">
          <div className="text-xs text-neutral-500 uppercase mb-2">Ringkasan poin</div>
          <div className="flex flex-wrap gap-6 items-baseline">
            <div>
              <span className="text-xs text-neutral-500">Total dari catatan</span>
              <div className="text-2xl font-bold tabular-nums">{breakdown.gross}</div>
            </div>
            {breakdown.adjustmentSum !== 0 && (
              <div>
                <span className="text-xs text-neutral-500">Penyesuaian (remisi periode tenang, dll.)</span>
                <div className="text-xl font-semibold tabular-nums">{breakdown.adjustmentSum}</div>
              </div>
            )}
            <div>
              <span className="text-xs text-neutral-500 font-semibold">Poin efektif</span>
              <div className="text-3xl font-bold tabular-nums text-red-700">{breakdown.effective}</div>
            </div>
          </div>
          <p className="text-xs text-neutral-600 mt-3">
            Remisi otomatis dapat diterapkan setelah ≥{quietDays} hari sejak tanggal kejadian pelanggaran terakhir
            (dihitung dari tanggal kejadian, bukan tanggal input).
            (bukan tanggal input catatan), sesuai kebijakan sekolah.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-12 sm:flex-row sm:justify-end">
          <div className="text-sm">
            <p className="mb-4 text-neutral-600">Mengetahui,</p>
            {/* sesuai permintaan: hapus teks \"Tanda tangan dan stempel sekolah (bila ada)\" */}
            <div className="mb-10" />
            <p className="min-w-[200px] border-t border-neutral-400 pt-2 font-semibold">{print.coordinatorName}</p>
            {print.coordinatorTitle ? (
              <p className="mt-0.5 text-xs text-neutral-600">{print.coordinatorTitle}</p>
            ) : null}
          </div>
        </div>
      </article>

      {/* Halaman 2: riwayat */}
      <article className="rounded-xl border bg-white p-4 text-black shadow-sm sm:p-8 print:border-0 print:shadow-none print:break-before-page">
        <header className="border-b border-neutral-300 pb-4 mb-6">
          <h2 className="text-base font-bold tracking-tight">RIWAYAT CATATAN POIN</h2>
          <p className="text-xs mt-1 text-neutral-600">
            Ringkasan riwayat pelanggaran dan remisi/penyesuaian poin (jika ada).
          </p>
        </header>

        <section className="mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 mb-3">Riwayat pelanggaran</h3>
          {history.records.length === 0 ? (
            <p className="text-sm text-neutral-600">Tidak ada catatan pelanggaran.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-neutral-500">Tanggal</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-neutral-500">Pelanggaran</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-neutral-500">Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {history.records.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="px-3 py-2">{r.violationName}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 mb-3">Riwayat remisi / penyesuaian</h3>
          {history.adjustments.length === 0 ? (
            <p className="text-sm text-neutral-600">Tidak ada remisi atau penyesuaian poin.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-neutral-500">Tanggal</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-neutral-500">Keterangan</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-neutral-500">Δ Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {history.adjustments.map((a) => (
                    <tr key={a.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                      <td className="px-3 py-2">{formatPointAdjustmentReason(a.reason)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{a.pointsDelta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </article>
    </div>
  );
}
