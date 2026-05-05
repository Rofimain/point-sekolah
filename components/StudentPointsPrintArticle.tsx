import { formatDate } from "@/lib/utils";

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
};

export function StudentPointsPrintArticle({
  studentName,
  nisn,
  classNameLabel,
  issued,
  print,
  breakdown,
}: StudentPointsPrintArticleProps) {
  return (
    <article
      className="rounded-xl border bg-white p-4 text-black shadow-sm sm:p-8 print:border-0 print:shadow-none"
      style={{ borderColor: "var(--border)" }}
    >
      <header className="text-center border-b border-neutral-300 pb-4 mb-6">
        <h1 className="text-lg font-bold tracking-tight">SURAT KETERANGAN POIN PELANGGARAN</h1>
        <p className="text-sm mt-1 text-neutral-600">Sistem Tata Tertib Sekolah — dicetak dari aplikasi resmi</p>
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
          Remisi otomatis 25% dapat diterapkan setelah ≥30 hari tanpa pelanggaran baru, sesuai kebijakan sekolah.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-12 sm:flex-row sm:justify-end">
        <div className="text-sm">
          <p className="mb-4 text-neutral-600">Mengetahui,</p>
          <p className="text-[11px] text-neutral-500 mb-10">Tanda tangan dan stempel sekolah (bila ada)</p>
          <p className="min-w-[200px] border-t border-neutral-400 pt-2 font-semibold">{print.coordinatorName}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{print.coordinatorTitle}</p>
        </div>
      </div>
    </article>
  );
}
