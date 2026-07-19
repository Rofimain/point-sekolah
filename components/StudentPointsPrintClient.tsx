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
import {
  extractPlaceholderKeys,
  TEMPLATE_OFFICIAL_PLACEHOLDERS,
} from "@/lib/print-templates";

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
  /** Prefill jenis surat dari query ?template=slug */
  initialTemplateSlug?: string | null;
};

const POINTS_DOC = "__points__";

/** Placeholder yang sudah terisi otomatis — tidak perlu field override. */
const AUTO_FILLED_KEYS = new Set([
  "nama",
  "kelas",
  "nis",
  "poin",
  "poin_terbilang",
  "daftar_pelanggaran",
  "tanggal",
  "alamat",
]);

function field(
  label: string,
  value: string,
  onChange: (v: string) => void,
  placeholder?: string
) {
  return (
    <div>
      <label
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      />
    </div>
  );
}

export function StudentPointsPrintClient({
  redaksi,
  backHref = "/students",
  backLabel = "← Kembali ke daftar siswa",
  letterTemplates,
  address,
  initialTemplateSlug = null,
  ...articleProps
}: Props) {
  const initialDoc = useMemo(() => {
    if (!initialTemplateSlug) return POINTS_DOC;
    const hit = letterTemplates.find((t) => t.slug === initialTemplateSlug);
    return hit?.id ?? POINTS_DOC;
  }, [initialTemplateSlug, letterTemplates]);

  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorTitle, setCoordinatorTitle] = useState("");
  const [kepalaSekolah, setKepalaSekolah] = useState("");
  const [namaPic, setNamaPic] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(initialDoc);
  const [nomorSurat, setNomorSurat] = useState("");
  const [lamaSkorsing, setLamaSkorsing] = useState("3");
  const [tanggalMulaiSkorsing, setTanggalMulaiSkorsing] = useState("");
  const [tanggalMasukKembali, setTanggalMasukKembali] = useState("");
  const [tanggalHijriah, setTanggalHijriah] = useState("");
  const [tanggalMasehi, setTanggalMasehi] = useState("");
  const [pasal, setPasal] = useState("");
  const [bunyiPasal, setBunyiPasal] = useState("");
  const [hariTanggalPertemuan, setHariTanggalPertemuan] = useState("");
  const [waktuPertemuan, setWaktuPertemuan] = useState("07.30 – 08.00 WIB");
  const [tempat, setTempat] = useState("");
  const [materiDiskusi, setMateriDiskusi] = useState("Akumulasi poin pelanggaran");
  const [urutanPoin, setUrutanPoin] = useState("1");
  const [periodeAwal, setPeriodeAwal] = useState("");
  const [periodeAkhir, setPeriodeAkhir] = useState("");
  const [batasRemisi, setBatasRemisi] = useState("");
  const [jenisSp, setJenisSp] = useState("SP-2");
  const [tanggalPerjanjian, setTanggalPerjanjian] = useState("");

  const selectedTemplate = letterTemplates.find((t) => t.id === selectedDoc) ?? null;
  const isPointsDoc = selectedDoc === POINTS_DOC;
  const slug = selectedTemplate?.slug ?? "";

  const overrideKeys = useMemo(() => {
    if (isPointsDoc) return new Set<string>();
    const official = TEMPLATE_OFFICIAL_PLACEHOLDERS[slug];
    const keys = official
      ? [...official]
      : selectedTemplate
        ? extractPlaceholderKeys(selectedTemplate.body)
        : [];
    return new Set(keys.filter((k) => !AUTO_FILLED_KEYS.has(k)));
  }, [isPointsDoc, slug, selectedTemplate]);

  const needs = (key: string) => overrideKeys.has(key);
  const hasLetterOverrides = overrideKeys.size > 0;

  const pageSettings: DocumentPageSettings = useMemo(
    () => parsePageSettings(selectedTemplate?.pageSettings),
    [selectedTemplate]
  );

  const daftarPelanggaran = useMemo(
    () =>
      articleProps.history.records
        .map((r, i) => `${i + 1}. ${r.violationName} (${r.points} poin)`)
        .join("\n"),
    [articleProps.history.records]
  );

  const vars = useMemo(
    () =>
      buildStudentPrintVars({
        name: articleProps.studentName,
        nisn: articleProps.nisn,
        className: articleProps.classNameLabel,
        address,
        effectivePoints: articleProps.breakdown.effective,
        kepalaSekolah: kepalaSekolah.trim() || undefined,
        nomorSurat: nomorSurat.trim() || undefined,
        daftarPelanggaran,
        lamaSkorsing,
        tanggalMulaiSkorsing: tanggalMulaiSkorsing.trim() || undefined,
        tanggalMasukKembali: tanggalMasukKembali.trim() || undefined,
        tanggalHijriah: tanggalHijriah.trim() || undefined,
        tanggalMasehi: tanggalMasehi.trim() || undefined,
        pasal: pasal.trim() || undefined,
        bunyiPasal: bunyiPasal.trim() || daftarPelanggaran || undefined,
        namaPic: namaPic.trim() || undefined,
        materiDiskusi,
        hariTanggalPertemuan: hariTanggalPertemuan.trim() || undefined,
        waktuPertemuan: waktuPertemuan.trim() || undefined,
        tempat: tempat.trim() || undefined,
        urutanPoin,
        periodeAwal: periodeAwal.trim() || undefined,
        periodeAkhir: periodeAkhir.trim() || undefined,
        batasRemisi: batasRemisi.trim() || undefined,
        jenisSp,
        tanggalPerjanjian: tanggalPerjanjian.trim() || undefined,
      }),
    [
      articleProps.studentName,
      articleProps.nisn,
      articleProps.classNameLabel,
      articleProps.breakdown.effective,
      address,
      kepalaSekolah,
      namaPic,
      nomorSurat,
      daftarPelanggaran,
      lamaSkorsing,
      tanggalMulaiSkorsing,
      tanggalMasukKembali,
      tanggalHijriah,
      tanggalMasehi,
      pasal,
      bunyiPasal,
      materiDiskusi,
      hariTanggalPertemuan,
      waktuPertemuan,
      tempat,
      urutanPoin,
      periodeAwal,
      periodeAkhir,
      batasRemisi,
      jenisSp,
      tanggalPerjanjian,
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
          className="rounded-xl border p-4 space-y-1 max-w-xl"
          style={{ background: "var(--accent-light)", borderColor: "var(--accent-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            {articleProps.studentName}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {[articleProps.classNameLabel, articleProps.nisn ? `NISN ${articleProps.nisn}` : null, `${articleProps.breakdown.effective} poin`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-[11px] pt-1" style={{ color: "var(--text-muted)" }}>
            Data siswa terisi otomatis. Field di bawah hanya untuk isian yang relevan dengan jenis surat.
          </p>
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

          {isPointsDoc && (
            <>
              <p className="text-xs font-semibold pt-1" style={{ color: "var(--text-primary)" }}>
                Data pejabat
              </p>
              {field("Nama pejabat / PIC", coordinatorName, setCoordinatorName, "mis. Drs. Hartanto")}
              {field("Jabatan", coordinatorTitle, setCoordinatorTitle, "mis. Koordinator BP/BK")}
            </>
          )}

          {!isPointsDoc && hasLetterOverrides && (
            <>
              <p className="text-xs font-semibold pt-1" style={{ color: "var(--text-primary)" }}>
                Isian tambahan surat
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {needs("kepala_sekolah") &&
                  field("Nama kepala sekolah", kepalaSekolah, setKepalaSekolah, "mis. H. Bahron Fathin, M.A.")}
                {needs("nama_pic") && field("Nama PIC", namaPic, setNamaPic, "mis. Bapak Ahmad Fauzi")}
                {needs("nomor_surat") && field("Nomor surat", nomorSurat, setNomorSurat, "123/SP1/VII/2026")}
                {needs("lama_skorsing") && field("Lama skorsing (hari)", lamaSkorsing, setLamaSkorsing, "3")}
                {needs("tanggal_mulai_skorsing") &&
                  field("Tanggal mulai skorsing", tanggalMulaiSkorsing, setTanggalMulaiSkorsing)}
                {needs("tanggal_masuk_kembali") &&
                  field("Tanggal masuk kembali", tanggalMasukKembali, setTanggalMasukKembali)}
                {needs("tanggal_hijriah") && field("Tanggal Hijriah", tanggalHijriah, setTanggalHijriah)}
                {needs("tanggal_masehi") && field("Tanggal Masehi", tanggalMasehi, setTanggalMasehi)}
                {needs("pasal") && field("Pasal", pasal, setPasal, "16 ayat 12")}
                {needs("bunyi_pasal") && field("Bunyi pasal", bunyiPasal, setBunyiPasal)}
                {needs("hari_tanggal_pertemuan") &&
                  field("Hari/tanggal pertemuan", hariTanggalPertemuan, setHariTanggalPertemuan)}
                {needs("waktu_pertemuan") && field("Waktu pertemuan", waktuPertemuan, setWaktuPertemuan)}
                {needs("tempat") && field("Tempat", tempat, setTempat)}
                {needs("materi_diskusi") && field("Materi diskusi", materiDiskusi, setMateriDiskusi)}
                {needs("urutan_poin") && field("Urutan info poin", urutanPoin, setUrutanPoin, "1")}
                {needs("periode_awal") && field("Periode awal", periodeAwal, setPeriodeAwal)}
                {needs("periode_akhir") && field("Periode akhir", periodeAkhir, setPeriodeAkhir)}
                {needs("batas_remisi") && field("Batas remisi", batasRemisi, setBatasRemisi)}
                {needs("jenis_sp") && field("Jenis SP", jenisSp, setJenisSp, "SP-2")}
                {needs("tanggal_perjanjian") &&
                  field("Tanggal perjanjian", tanggalPerjanjian, setTanggalPerjanjian)}
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
        <>
          <div className="no-print">
            <DocumentPrintView
              bodyHtml={selectedTemplate.body}
              pageSettings={pageSettings}
              vars={vars}
              printId="student-letter-preview"
              variant="screen"
            />
          </div>
          <div className="hidden print:block">
            <DocumentPrintView
              bodyHtml={selectedTemplate.body}
              pageSettings={pageSettings}
              vars={vars}
              printId="student-letter-print"
              variant="print-surface"
            />
          </div>
        </>
      ) : null}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
