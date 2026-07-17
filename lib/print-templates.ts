export type PrintTemplateSeed = {
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
};

export const PRINT_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "nama", label: "Nama siswa" },
  { key: "kelas", label: "Kelas" },
  { key: "nis", label: "Nomor induk / NISN" },
  { key: "poin", label: "Jumlah poin" },
  { key: "poin_terbilang", label: "Poin terbilang" },
  { key: "tanggal", label: "Tanggal surat" },
  { key: "nomor_surat", label: "Nomor surat" },
  { key: "daftar_pelanggaran", label: "Daftar pelanggaran" },
  { key: "hari_skorsing", label: "Durasi skorsing (hari)" },
  { key: "tanggal_skorsing", label: "Tanggal mulai skorsing" },
  { key: "tanggal_kembali", label: "Tanggal kembali sekolah" },
  { key: "pic", label: "Nama PIC / pejabat" },
  { key: "materi", label: "Materi diskusi" },
  { key: "alamat", label: "Alamat siswa" },
  { key: "kepala_sekolah", label: "Nama kepala sekolah" },
  { key: "sekolah", label: "Nama sekolah" },
];

export const PREVIEW_SAMPLE_VARS: Record<string, string> = {
  nama: "Fakhirah Shakila Rizqi",
  kelas: "X.1",
  nis: "1234567890",
  poin: "55",
  poin_terbilang: "Lima puluh lima",
  tanggal: "17 Juli 2026",
  nomor_surat: "30/SP.1/Tanse/VII/1447.2026",
  daftar_pelanggaran:
    "Pasal 52 yang berbunyi : Terlambat masuk sekolah sampai jam 07.00 WIB.",
  hari_skorsing: "2",
  tanggal_skorsing: "18 Juli 2026",
  tanggal_kembali: "20 Juli 2026",
  pic: "Koordinator Ketahanan Sekolah",
  materi: "Pembinaan akumulasi poin pelanggaran tata tertib",
  alamat: "Jl. Contoh No. 1, Jakarta",
  kepala_sekolah: "H. Bahron Fathin, M.A",
  sekolah: "SMA Islam Al Azhar 1 Jakarta",
};

export function slugifyPrintTemplate(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `surat-${Date.now().toString(36)}`;
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
    const value = vars[key.toLowerCase()];
    return value != null && value !== "" ? value : `{{${key}}}`;
  });
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sortPrintTemplates<T extends { sortOrder: number; title: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "id"));
}

export const DEFAULT_PRINT_TEMPLATES: PrintTemplateSeed[] = [
  {
    slug: "sp1",
    title: "Surat Peringatan 1 (SP1)",
    sortOrder: 10,
    body: `Nomor : {{nomor_surat}}
{{tanggal}}
Lamp. : 1 berkas
Perihal : SP1

SURAT PERINGATAN PERTAMA (SP1)

Assalamu'alaikum Wr.Wb.

Sehubungan dengan akumulasi pelanggaran tata tertib ananda :
Nama: {{nama}}
Kelas: {{kelas}}
Nomor Induk: {{nis}}

telah mencapai akumulasi poin pelanggaran tata tertib sekolah sebanyak {{poin}} poin ({{poin_terbilang}}) yang tercatat sebagai berikut :

{{daftar_pelanggaran}}

Surat peringatan pertama ini diberikan sebagai peringatan awal agar diperhatikan dan menjadi pengingat agar tidak mengulangi perbuatan yang melanggar tata tertib sekolah lagi. Surat SP1 ini sebagai catatan dan berlaku selama menjadi murid {{sekolah}}.

Demikian Surat Peringatan 1 (SP 1) ini dibuat agar menjadi perhatian dan perbaikan.

Wassalamualaikum Wr.Wb.

Kepala {{sekolah}}



{{kepala_sekolah}}`,
  },
  {
    slug: "sp2",
    title: "Surat Peringatan 2 (SP2)",
    sortOrder: 20,
    body: `Nomor : {{nomor_surat}}
{{tanggal}}
Lamp. : 1 berkas
Perihal : SP 2

SURAT PERINGATAN Ke-2 (SP-2)

Assalamualaikum wr wb.

Sehubungan dengan akumulasi pelanggaran tata tertib ananda :
Nama: {{nama}}
Kelas: {{kelas}}
Nomor Induk : {{nis}}

telah mencapai akumulasi poin pelanggaran tata tertib sekolah sebanyak {{poin}} ({{poin_terbilang}}) yang tercatat sebagai berikut :

{{daftar_pelanggaran}}

Surat peringatan ke-2 ini diberikan agar diperhatikan dan menjadi pengingat agar tidak mengulangi perbuatan yang melanggar tata tertib sekolah lagi. Surat SP-2 ini sebagai catatan dan berlaku selama menjadi murid {{sekolah}}.

Demikian surat Peringatan Ke-2 (SP 2) ini dibuat agar menjadi perhatian dan perbaikan.

Wassalamualaikum wr.wb.

Kepala {{sekolah}}



{{kepala_sekolah}}`,
  },
  {
    slug: "sp3",
    title: "Surat Peringatan 3 (SP3)",
    sortOrder: 30,
    body: `Nomor : {{nomor_surat}}
{{tanggal}}
Lamp. :
Perihal : SP3

SURAT PERINGATAN KETIGA (SP3)
(Peringatan terakhir)

Assalamu'alaikum Warrohmatullohi Wabarakatuh.

Sehubungan dengan akumulasi pelanggaran tata tertib ananda yang bernama :
Nama: {{nama}}
Kelas: {{kelas}}
Nomor Induk: {{nis}}

telah melakukan akumulasi pelanggaran tata tertib sekolah berupa:

{{daftar_pelanggaran}}

Total point yang terakumulasi = {{poin}}

Surat peringatan ke-3 (ketiga) ini diberikan sebagai peringatan terakhir yang wajib diperhatikan dan dipatuhi/ditaati. Apabila di kemudian hari dimulai dari tanggal diterbitkan surat SP-3 ini, terjadi perbuatan pelanggaran tata tertib lagi baik pada pasal yang sama maupun pada pasal berbeda maka sanksi yang diberikan berupa dikembalikan ke orang tua atau dikeluarkan dari {{sekolah}}.

Demikian Surat Peringatan ke-3 (SP 3) ini dibuat agar diperhatikan dan wajib dipatuhi/taati.

Wassalamu'alaikum Warrohmatullohi Wabarokaatuh.

Kepala {{sekolah}}



{{kepala_sekolah}}`,
  },
  {
    slug: "info-poin",
    title: "Surat Info Poin",
    sortOrder: 40,
    body: `Hal: Informasi poin pelanggaran tata-tertib
{{tanggal}}

Kepada Yth.
Bapak/Ibu Orang Tua Murid
Ananda {{nama}} ({{kelas}})
{{sekolah}}
di- Jakarta

Assalamualaikum Wr. Wb.

Salam ta'zim kami sampaikan semoga kita semua senantiasa berada dalam lindungan Allah SWT serta sukses dalam menjalankan tugas sehari-hari, Aamiin Yaa Robbal'aalamiin.

Dengan surat ini kami beritahukan bahwa poin pelanggaran tata tertib Ananda di sekolah sudah mencapai {{poin}} poin.

Besar harapan kami masalah ini dapat teratasi karena jika poin Ananda bertambah lagi, maka sesuai dengan tata tertib sekolah Ananda dapat diberikan Surat Peringatan dan/atau sanksi skorsing sesuai ketentuan yang berlaku.

Jika Ananda tidak melakukan pelanggaran tata tertib kembali selama periode tenang yang ditentukan, maka Ananda dapat mendapat remisi/pengurangan poin sesuai kebijakan sekolah.

Demikian surat informasi dari kami, atas perhatian Bapak/Ibu kami ucapkan terima kasih.

Billahit Taufiq Walhidayah
Wassalamu 'alaikum Wr. Wb.

Kepala {{sekolah}}                    Mengetahui
                                          Orangtua Murid



{{kepala_sekolah}}                         ........................................

Catatan : Surat ini dikembalikan ke sekolah setelah ditandatangani oleh orangtua murid paling lambat 2 hari sejak tanggal pemberian surat.`,
  },
  {
    slug: "pemanggilan-otm",
    title: "Surat Pemanggilan OTM",
    sortOrder: 50,
    body: `Nomor   : {{nomor_surat}}
{{tanggal}}
Lamp     : -

Kepada
Yth. Bapak & Ibu Orang Tua
Ananda {{nama}} ({{kelas}})
{{sekolah}}
di- Jakarta

Assalamu 'alaikum Wr. Wb.

Salam ta'zim kami sampaikan semoga kita semua senantiasa berada dalam lindungan Allah SWT serta sukses dalam menjalankan tugas sehari-hari, Aamiin Yaa Robbal'aalamiin.

Sehubungan dengan kondisi akumulasi poin pelanggaran Ananda {{nama}} sampai saat ini sudah mencapai {{poin}} poin. Kami mengharapkan kehadiran Bapak / Ibu pada

hari/tanggal : {{tanggal}}
waktu : 07.30 – 08.00 WIB
tempat : R. Tamu Kepala {{sekolah}}
menemui : {{pic}}
Untuk membicarakan : {{materi}}

Demikian surat ini kami sampaikan, atas perhatian dan kesediaan Bapak/Ibu untuk hadir, kami ucapkan terima kasih.

Billahit Taufiq Walhidayah
Wassalamu 'alaikum Wr. Wb.

Kepala {{sekolah}}



{{kepala_sekolah}}

Catatan :
Harap hadir sesuai dengan waktu yang telah ditentukan.`,
  },
  {
    slug: "perjanjian-khusus",
    title: "Surat Perjanjian Khusus",
    sortOrder: 60,
    body: `SURAT PERJANJIAN KHUSUS

Yang bertanda tangan di bawah ini adalah :
Nama: {{nama}}
Kelas: {{kelas}}
Alamat: {{alamat}}

Menyatakan, bahwa saya telah menerima SP-2 karena akumulasi poin sejumlah : {{poin}} poin karena melanggar tata tertib sekolah seperti yang tercantum dalam lampiran info poin.

Untuk itu saya berjanji :
1. Tidak akan melanggar tata tertib sekolah lagi dan akan mentaatinya
2. Akan belajar sebaik-baiknya
3. Akan selalu menjaga nama baik sendiri, keluarga dan sekolah.

Apabila dikemudian hari saya masih melakukan pelanggaran tata tertib sekolah lagi maka saya bersedia menerima sanksi sesuai dengan tata tertib yang berlaku berupa:
1. Pelanggaran yang sama berdampak dikembalikan kepada orang tua (dikeluarkan dari sekolah)
2. Pelanggaran yang berdampak poin dapat menambah jumlah poin sehingga dikembalikan kepada orang tua (dikeluarkan dari sekolah)

Demikianlah surat perjanjian ini saya buat dengan penuh kesadaran dan kesungguhan.

{{tanggal}}

Menyaksikan,
Wali kelas              Orangtua/wali murid        saya yang berjanji

Materai Rp. 10.000,-

________________       _______________________             _______________________

Mengetahui,

Kepala {{sekolah}}          Korbid Tanse           Bimb. Konseling

________________       _______________________             _______________________`,
  },
  {
    slug: "skorsing",
    title: "Surat Skorsing",
    sortOrder: 70,
    body: `Nomor  : {{nomor_surat}}
{{tanggal}}
Lampiran    : 1
Hal           : Sanksi Belajar Di Rumah

Kepada Yth :
Bapak dan Ibu Orang Tua
Ananda {{nama}} ({{kelas}})
di Tempat

Assalamu'alaikum Wr.Wb.

Bersama ini kami sampaikan bahwa putra/putri bapak/ibu yang bernama: {{nama}} kelas {{kelas}} telah melanggar tata tertib sekolah.

{{daftar_pelanggaran}}

Sesuai tata tertib sekolah, putra/putri bapak ibu diberikan sanksi belajar di rumah selama : {{hari_skorsing}} hari, tanggal {{tanggal_skorsing}}. Putra/putri bapak/ibu mulai sekolah kembali pada tanggal {{tanggal_kembali}}.

Selama belajar di rumah putra/putri bapak/ibu ditugaskan untuk mengerjakan tugas-tugas yang diminta kepada guru yang bersangkutan dengan pelajaran yang ditinggalkan, serta tidak boleh berada di lingkungan sekolah dan sekitarnya selama dalam masa skorsing.

Apabila diketahui berada di lingkungan sekolah dalam masa skorsing maka skorsing ditambah 1 hari.

Demikianlah surat pemberitahuan ini. Atas perhatian bapak/ibu kami ucapkan terima kasih.

Billahit Taufiq Walhidayah
Wassalamu'alaikum Wr.Wb

Ketahanan Sekolah                    Wali Kelas


_______________                               __________________

Mengetahui
Kepala {{sekolah}}


{{kepala_sekolah}}`,
  },
];
