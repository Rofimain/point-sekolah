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
  hariSkorsing?: string;
  tanggalSkorsing?: string;
  tanggalKembali?: string;
  pic?: string;
  materi?: string;
};

/** Angka → terbilang sederhana (Indonesia), cukup untuk poin surat. */
export function poinTerbilang(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 0) return "nol";
  const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
  const belasan = ["sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas"];
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
  return {
    nama: src.name,
    kelas: src.className ?? "—",
    nis: src.nisn ?? "—",
    poin: String(src.effectivePoints),
    poin_terbilang: poinTerbilang(src.effectivePoints),
    tanggal: formatDate(new Date()),
    nomor_surat: src.nomorSurat?.trim() || "…/…/…",
    daftar_pelanggaran: src.daftarPelanggaran?.trim() || "—",
    hari_skorsing: src.hariSkorsing ?? "…",
    tanggal_skorsing: src.tanggalSkorsing ?? "…",
    tanggal_kembali: src.tanggalKembali ?? "…",
    pic: src.pic ?? "…",
    materi: src.materi ?? "Akumulasi poin pelanggaran",
    alamat: src.address?.trim() || "—",
    kepala_sekolah: src.kepalaSekolah?.trim() || "_______________________",
    sekolah: SCHOOL_NAME,
  };
}
