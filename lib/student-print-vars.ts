import { SCHOOL_NAME } from "@/lib/branding";
import { formatDate } from "@/lib/utils";

export type StudentPrintSource = {
  name: string;
  nisn: string | null;
  className: string | null;
  address?: string | null;
  effectivePoints: number;
  kepalaSekolah?: string;
  nomorSurat?: string;
  daftarPelanggaran?: string;
  /** Alias lama / baru untuk skorsing */
  lamaSkorsing?: string;
  hariSkorsing?: string;
  tanggalMulaiSkorsing?: string;
  tanggalSkorsing?: string;
  tanggalMasukKembali?: string;
  tanggalKembali?: string;
  tanggalHijriah?: string;
  tanggalMasehi?: string;
  pasal?: string;
  bunyiPasal?: string;
  namaPic?: string;
  pic?: string;
  materiDiskusi?: string;
  materi?: string;
  hariTanggalPertemuan?: string;
  waktuPertemuan?: string;
  tempat?: string;
  urutanPoin?: string;
  periodeAwal?: string;
  periodeAkhir?: string;
  batasRemisi?: string;
  jenisSp?: string;
  tanggalPerjanjian?: string;
};

/** Angka → terbilang sederhana (Indonesia), cukup untuk poin surat. */
export function poinTerbilang(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 0) return "nol";
  const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
  const belasan = [
    "sepuluh",
    "sebelas",
    "dua belas",
    "tiga belas",
    "empat belas",
    "lima belas",
    "enam belas",
    "tujuh belas",
    "delapan belas",
    "sembilan belas",
  ];
  if (abs < 10) return satuan[abs];
  if (abs < 20) return belasan[abs - 10];
  if (abs < 100) {
    const puluh = Math.floor(abs / 10);
    const sisa = abs % 10;
    return `${satuan[puluh]} puluh${sisa ? ` ${satuan[sisa]}` : ""}`.trim();
  }
  if (abs < 200) return `seratus${abs % 100 ? ` ${poinTerbilang(abs % 100)}` : ""}`;
  if (abs < 1000) {
    const ratus = Math.floor(abs / 100);
    const sisa = abs % 100;
    return `${satuan[ratus]} ratus${sisa ? ` ${poinTerbilang(sisa)}` : ""}`.trim();
  }
  return String(abs);
}

export function buildStudentPrintVars(src: StudentPrintSource): Record<string, string> {
  const tanggal = formatDate(new Date());
  const lama = src.lamaSkorsing ?? src.hariSkorsing ?? "…";
  const tMulai = src.tanggalMulaiSkorsing ?? src.tanggalSkorsing ?? "…";
  const tKembali = src.tanggalMasukKembali ?? src.tanggalKembali ?? "…";
  const pic = src.namaPic ?? src.pic ?? "…";
  const materi = src.materiDiskusi ?? src.materi ?? "Akumulasi poin pelanggaran";

  return {
    nama: src.name,
    kelas: src.className ?? "—",
    nis: src.nisn ?? "—",
    poin: String(src.effectivePoints),
    poin_terbilang: poinTerbilang(src.effectivePoints),
    tanggal,
    nomor_surat: src.nomorSurat?.trim() || "…/…/…",
    daftar_pelanggaran: src.daftarPelanggaran?.trim() || "—",
    sekolah: SCHOOL_NAME,
    kepala_sekolah: src.kepalaSekolah?.trim() || "_______________________",
    alamat: src.address?.trim() || "—",
    tanggal_hijriah: src.tanggalHijriah ?? tanggal,
    tanggal_masehi: src.tanggalMasehi ?? tanggal,
    pasal: src.pasal ?? "…",
    bunyi_pasal: src.bunyiPasal?.trim() || src.daftarPelanggaran?.trim() || "—",
    lama_skorsing: lama,
    tanggal_mulai_skorsing: tMulai,
    tanggal_masuk_kembali: tKembali,
    // alias lama (jika template custom masih memakai nama lama)
    hari_skorsing: lama,
    tanggal_skorsing: tMulai,
    tanggal_kembali: tKembali,
    hari_tanggal_pertemuan: src.hariTanggalPertemuan ?? tanggal,
    waktu_pertemuan: src.waktuPertemuan ?? "07.30 – 08.00 WIB",
    tempat: src.tempat ?? `R. Tamu Kepala ${SCHOOL_NAME}`,
    nama_pic: pic,
    materi_diskusi: materi,
    pic,
    materi,
    urutan_poin: src.urutanPoin ?? "1",
    periode_awal: src.periodeAwal ?? "…",
    periode_akhir: src.periodeAkhir ?? tanggal,
    batas_remisi: src.batasRemisi ?? "…",
    jenis_sp: src.jenisSp ?? "SP-2",
    tanggal_perjanjian: src.tanggalPerjanjian ?? tanggal,
  };
}
