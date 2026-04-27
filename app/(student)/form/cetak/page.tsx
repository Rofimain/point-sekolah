import Link from "next/link";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPrintBlock } from "@/lib/app-settings";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/PrintButton";
import { TopBar } from "@/components/layouts/TopBar";

export default async function StudentPrintPointsPage() {
  const session = await getSafeServerSession();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const [print, student, breakdown] = await Promise.all([
    getPrintBlock(),
    prisma.user.findUnique({ where: { id: session.user.id }, include: { class: true } }),
    getEffectivePointsBreakdown(session.user.id),
  ]);

  const issued = new Date();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <TopBar />
      <div className="max-w-3xl mx-auto p-5 pb-16">
        <div className="no-print flex items-center justify-between gap-3 mb-6">
          <Link href="/form" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            ← Kembali ke portal
          </Link>
          <PrintButton />
        </div>

        <article
          className="rounded-xl border p-8 bg-white text-black shadow-sm print:shadow-none print:border-0"
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
              <dd className="font-semibold">{student?.name ?? session.user.name}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs uppercase">NISN</dt>
              <dd>{student?.nisn ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs uppercase">Kelas</dt>
              <dd>{student?.class?.name ?? "—"}</dd>
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

          <div className="mt-12 flex flex-col sm:flex-row sm:justify-end gap-12">
            <div className="text-sm">
              <p className="mb-16 text-neutral-600">Mengetahui,</p>
              <p className="font-semibold border-t border-neutral-400 pt-2 min-w-[200px]">{print.coordinatorName}</p>
              <p className="text-neutral-600 text-xs mt-0.5">{print.coordinatorTitle}</p>
            </div>
          </div>
        </article>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
