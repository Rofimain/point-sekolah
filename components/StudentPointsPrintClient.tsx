"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import {
  StudentPointsPrintArticle,
  type StudentPointsPrintArticleProps,
} from "@/components/StudentPointsPrintArticle";
import { DocumentPrintView } from "@/components/document-editor";
import { parsePageSettings, type DocumentPageSettings } from "@/lib/document-page";
import { buildStudentPrintVars } from "@/lib/student-print-vars";

export type LetterTemplateOption = {
  id: string;
  slug: string;
  title: string;
  body: string;
  pageSettings: string | null;
};

type Props = Omit<StudentPointsPrintArticleProps, "print"> & {
  redaksi: string;
  backHref?: string;
  backLabel?: string;
  letterTemplates: LetterTemplateOption[];
  address?: string | null;
};

const POINTS_DOC = "__points__";

export function StudentPointsPrintClient({
  redaksi,
  backHref = "/students",
  backLabel = "← Kembali ke daftar siswa",
  letterTemplates,
  address,
  ...articleProps
}: Props) {
  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorTitle, setCoordinatorTitle] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(POINTS_DOC);
  const [nomorSurat, setNomorSurat] = useState("");
  const [hariSkorsing, setHariSkorsing] = useState("3");
  const [materi, setMateri] = useState("Akumulasi poin pelanggaran");

  const selectedTemplate = letterTemplates.find((t) => t.id === selectedDoc) ?? null;
  const isPointsDoc = selectedDoc === POINTS_DOC;

  const pageSettings: DocumentPageSettings = useMemo(
    () => parsePageSettings(selectedTemplate?.pageSettings),
    [selectedTemplate]
  );

  const vars = useMemo(
    () =>
      buildStudentPrintVars({
        name: articleProps.studentName,
        nisn: articleProps.nisn,
        className: articleProps.classNameLabel,
        address,
        effectivePoints: articleProps.breakdown.effective,
        kepalaSekolah: coordinatorName.trim() || undefined,
        nomorSurat: nomorSurat.trim() || undefined,
        daftarPelanggaran: articleProps.history.records
          .map(
            (r, i) =>
              `${i + 1}. ${r.violationName} (${r.points} poin)`
          )
          .join("\n"),
        hariSkorsing,
        materi,
        pic: coordinatorName.trim() || coordinatorTitle.trim() || undefined,
      }),
    [
      articleProps.studentName,
      articleProps.nisn,
      articleProps.classNameLabel,
      articleProps.breakdown.effective,
      articleProps.history.records,
      address,
      coordinatorName,
      coordinatorTitle,
      nomorSurat,
      hariSkorsing,
      materi,
    ]
  );

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
            Jenis dokumen
          </p>
          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value={POINTS_DOC}>Surat Keterangan Poin</option>
            {letterTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <p className="text-xs font-semibold pt-1" style={{ color: "var(--text-primary)" }}>
            Data pejabat / surat
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Nama (kepala / PIC)
            </label>
            <input
              value={coordinatorName}
              onChange={(e) => setCoordinatorName(e.target.value)}
              placeholder="mis. Drs. Hartanto"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Jabatan
            </label>
            <input
              value={coordinatorTitle}
              onChange={(e) => setCoordinatorTitle(e.target.value)}
              placeholder="mis. Koordinator BP/BK"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          {!isPointsDoc && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Nomor surat
                </label>
                <input
                  value={nomorSurat}
                  onChange={(e) => setNomorSurat(e.target.value)}
                  placeholder="mis. 123/SP1/VII/2026"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Materi / hari skorsing
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={materi}
                    onChange={(e) => setMateri(e.target.value)}
                    placeholder="Materi diskusi"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                  <input
                    value={hariSkorsing}
                    onChange={(e) => setHariSkorsing(e.target.value)}
                    placeholder="Hari skorsing"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isPointsDoc ? (
        <StudentPointsPrintArticle
          {...articleProps}
          print={{
            redaksi,
            coordinatorName: coordinatorName.trim() || "_______________________",
            coordinatorTitle: coordinatorTitle.trim(),
          }}
        />
      ) : selectedTemplate ? (
        <DocumentPrintView
          bodyHtml={selectedTemplate.body}
          pageSettings={pageSettings}
          vars={vars}
          printId="student-letter-print"
        />
      ) : null}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
