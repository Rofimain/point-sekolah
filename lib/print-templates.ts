export type PrintTemplateSeed = {
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
};

/** Naikkan versi ini bila layout default template diubah (satu kali sync ke DB). */
export const PRINT_TEMPLATES_LAYOUT_VERSION = "7";

/** Katalog global placeholder (chip UI + soft-warning). User boleh pakai token di luar daftar. */
export const PRINT_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "nama", label: "Nama siswa" },
  { key: "kelas", label: "Kelas" },
  { key: "nis", label: "Nomor induk / NISN" },
  { key: "poin", label: "Jumlah poin" },
  { key: "poin_terbilang", label: "Poin terbilang" },
  { key: "tanggal", label: "Tanggal surat" },
  { key: "nomor_surat", label: "Nomor surat" },
  { key: "daftar_pelanggaran", label: "Daftar pelanggaran" },
  { key: "sekolah", label: "Nama sekolah" },
  { key: "kepala_sekolah", label: "Nama kepala sekolah" },
  { key: "alamat", label: "Alamat siswa" },
  { key: "tanggal_hijriah", label: "Tanggal Hijriah" },
  { key: "tanggal_masehi", label: "Tanggal Masehi" },
  { key: "pasal", label: "Pasal pelanggaran" },
  { key: "bunyi_pasal", label: "Bunyi pasal" },
  { key: "lama_skorsing", label: "Lama skorsing (hari)" },
  { key: "tanggal_mulai_skorsing", label: "Tanggal mulai skorsing" },
  { key: "tanggal_masuk_kembali", label: "Tanggal masuk kembali" },
  { key: "hari_tanggal_pertemuan", label: "Hari/tanggal pertemuan" },
  { key: "waktu_pertemuan", label: "Waktu pertemuan" },
  { key: "tempat", label: "Tempat pertemuan" },
  { key: "nama_pic", label: "Nama PIC" },
  { key: "materi_diskusi", label: "Materi diskusi" },
  { key: "urutan_poin", label: "Urutan info poin (ke-n)" },
  { key: "periode_awal", label: "Periode awal" },
  { key: "periode_akhir", label: "Periode akhir" },
  { key: "batas_remisi", label: "Batas remisi" },
  { key: "jenis_sp", label: "Jenis SP (mis. SP-2)" },
  { key: "tanggal_perjanjian", label: "Tanggal perjanjian" },
];

/** Placeholder resmi per jenis surat default (untuk soft-warning saja). */
export const TEMPLATE_OFFICIAL_PLACEHOLDERS: Record<string, readonly string[]> = {
  sp1: [
    "nomor_surat",
    "tanggal",
    "nama",
    "kelas",
    "nis",
    "poin",
    "poin_terbilang",
    "daftar_pelanggaran",
    "sekolah",
    "kepala_sekolah",
  ],
  sp2: [
    "nomor_surat",
    "tanggal",
    "nama",
    "kelas",
    "nis",
    "poin",
    "poin_terbilang",
    "daftar_pelanggaran",
    "sekolah",
    "kepala_sekolah",
  ],
  sp3: [
    "nomor_surat",
    "tanggal",
    "nama",
    "kelas",
    "nis",
    "poin",
    "poin_terbilang",
    "daftar_pelanggaran",
    "sekolah",
    "kepala_sekolah",
  ],
  skorsing: [
    "nomor_surat",
    "tanggal_hijriah",
    "tanggal_masehi",
    "nama",
    "kelas",
    "pasal",
    "bunyi_pasal",
    "lama_skorsing",
    "tanggal_mulai_skorsing",
    "tanggal_masuk_kembali",
    "sekolah",
    "kepala_sekolah",
  ],
  "pemanggilan-otm": [
    "nomor_surat",
    "tanggal",
    "nama",
    "kelas",
    "poin",
    "hari_tanggal_pertemuan",
    "waktu_pertemuan",
    "tempat",
    "nama_pic",
    "materi_diskusi",
    "sekolah",
    "kepala_sekolah",
  ],
  "info-poin": [
    "tanggal",
    "nama",
    "kelas",
    "urutan_poin",
    "periode_awal",
    "periode_akhir",
    "poin",
    "batas_remisi",
    "sekolah",
    "kepala_sekolah",
  ],
  "perjanjian-khusus": ["nama", "kelas", "alamat", "jenis_sp", "poin", "tanggal_perjanjian", "sekolah"],
};

const ALL_OFFICIAL_KEYS = new Set(PRINT_PLACEHOLDERS.map((p) => p.key));

/** Ambil token {{key}} dan data-placeholder dari HTML/teks redaksi. */
export function extractPlaceholderKeys(body: string): string[] {
  const keys = new Set<string>();
  const reBrace = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = reBrace.exec(body))) keys.add(m[1].toLowerCase());
  const reAttr = /data-placeholder\s*=\s*["']([a-z0-9_]+)["']/gi;
  while ((m = reAttr.exec(body))) keys.add(m[1].toLowerCase());
  return [...keys].sort();
}

/**
 * Soft-warning: token di body yang tidak ada di daftar resmi jenis surat
 * (atau katalog global bila slug kustom). Tidak memblokir simpan.
 */
export function findUnrecognizedPlaceholders(body: string, slug?: string): string[] {
  const used = extractPlaceholderKeys(body);
  const official =
    slug && TEMPLATE_OFFICIAL_PLACEHOLDERS[slug]
      ? new Set(TEMPLATE_OFFICIAL_PLACEHOLDERS[slug])
      : ALL_OFFICIAL_KEYS;
  return used.filter((k) => !official.has(k));
}

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

/** Lebar baris cetak (monospace) untuk penataan kolom tanda tangan. */
const TTD_LINE_WIDTH = 72;
const TTD_SIGN_LINE = "_______________";
const TTD_GAP = ["", ""];

function ttdOne(role: string, name: string): string {
  return [role, ...TTD_GAP, name].join("\n");
}

function ttdColumns(cols: { role: string; name?: string }[]): string {
  const n = cols.length;
  const colWidth = Math.floor(TTD_LINE_WIDTH / n);
  const cell = (text: string, isLast: boolean) => (isLast ? text : text.padEnd(colWidth, " "));
  const roleLine = cols.map((c, i) => cell(c.role, i === n - 1)).join("");
  const nameLine = cols.map((c, i) => cell(c.name ?? TTD_SIGN_LINE, i === n - 1)).join("");
  return [roleLine, ...TTD_GAP, nameLine].join("\n");
}

function ttdTwo(leftRole: string, rightRole: string, leftName = TTD_SIGN_LINE, rightName = TTD_SIGN_LINE): string {
  return ttdColumns([
    { role: leftRole, name: leftName },
    { role: rightRole, name: rightName },
  ]);
}

function ttdThree(a: string, b: string, c: string): string {
  return ttdColumns([{ role: a }, { role: b }, { role: c }]);
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

${ttdOne("Kepala {{sekolah}}", "{{kepala_sekolah}}")}`,
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

${ttdOne("Kepala {{sekolah}}", "{{kepala_sekolah}}")}`,
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

Total point yang terakumulasi = {{poin}} ({{poin_terbilang}})

Surat peringatan ke-3 (ketiga) ini diberikan sebagai peringatan terakhir yang wajib diperhatikan dan dipatuhi/ditaati. Apabila di kemudian hari dimulai dari tanggal diterbitkan surat SP-3 ini, terjadi perbuatan pelanggaran tata tertib lagi baik pada pasal yang sama maupun pada pasal berbeda maka sanksi yang diberikan berupa dikembalikan ke orang tua atau dikeluarkan dari {{sekolah}}.

Demikian Surat Peringatan ke-3 (SP 3) ini dibuat agar diperhatikan dan wajib dipatuhi/taati.

Wassalamu'alaikum Warrohmatullohi Wabarokaatuh.

${ttdOne("Kepala {{sekolah}}", "{{kepala_sekolah}}")}`,
  },
  {
    slug: "info-poin",
    title: "Surat Info Poin",
    sortOrder: 40,
    body: `Hal: Informasi poin pelanggaran tata-tertib
Urutan info: {{urutan_poin}}
Periode: {{periode_awal}} – {{periode_akhir}}
Batas remisi: {{batas_remisi}}
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

${ttdTwo("Kepala {{sekolah}}", "Orangtua Murid", "{{kepala_sekolah}}", "................................")}

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

hari/tanggal : {{hari_tanggal_pertemuan}}
waktu : {{waktu_pertemuan}}
tempat : {{tempat}}
menemui : {{nama_pic}}
Untuk membicarakan : {{materi_diskusi}}

Demikian surat ini kami sampaikan, atas perhatian dan kesediaan Bapak/Ibu untuk hadir, kami ucapkan terima kasih.

Billahit Taufiq Walhidayah
Wassalamu 'alaikum Wr. Wb.

${ttdOne("Kepala {{sekolah}}", "{{kepala_sekolah}}")}

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

Menyatakan, bahwa saya telah menerima {{jenis_sp}} karena akumulasi poin sejumlah : {{poin}} poin karena melanggar tata tertib sekolah seperti yang tercantum dalam lampiran info poin.

Untuk itu saya berjanji :
1. Tidak akan melanggar tata tertib sekolah lagi dan akan mentaatinya
2. Akan belajar sebaik-baiknya
3. Akan selalu menjaga nama baik sendiri, keluarga dan sekolah.

Apabila dikemudian hari saya masih melakukan pelanggaran tata tertib sekolah lagi maka saya bersedia menerima sanksi sesuai dengan tata tertib yang berlaku berupa:
1. Pelanggaran yang sama berdampak dikembalikan kepada orang tua (dikeluarkan dari sekolah)
2. Pelanggaran yang berdampak poin dapat menambah jumlah poin sehingga dikembalikan kepada orang tua (dikeluarkan dari sekolah)

Demikianlah surat perjanjian ini saya buat dengan penuh kesadaran dan kesungguhan.

{{tanggal_perjanjian}}

Menyaksikan,
${ttdThree("Wali kelas", "Orangtua/wali murid", "saya yang berjanji")}

Materai Rp. 10.000,-

Mengetahui,
${ttdThree("Kepala {{sekolah}}", "Korbid Tanse", "Bimb. Konseling")}`,
  },
  {
    slug: "skorsing",
    title: "Surat Skorsing",
    sortOrder: 70,
    body: `Nomor  : {{nomor_surat}}
{{tanggal_hijriah}}
Lampiran    : 1
{{tanggal_masehi}}
Hal           : Sanksi Belajar Di Rumah

Kepada Yth :
Bapak dan Ibu Orang Tua
Ananda {{nama}} ({{kelas}})
di Tempat

Assalamu'alaikum Wr.Wb.

Bersama ini kami sampaikan bahwa putra/putri bapak/ibu yang bernama: {{nama}} kelas {{kelas}} telah melanggar tata tertib sekolah Pasal {{pasal}} yang berbunyi : {{bunyi_pasal}}.

Sesuai tata tertib sekolah, putra/putri bapak ibu diberikan sanksi belajar di rumah selama : {{lama_skorsing}} hari, tanggal {{tanggal_mulai_skorsing}}. Putra/putri bapak/ibu mulai sekolah kembali pada tanggal {{tanggal_masuk_kembali}}.

Selama belajar di rumah putra/putri bapak/ibu ditugaskan untuk mengerjakan tugas-tugas yang diminta kepada guru yang bersangkutan dengan pelajaran yang ditinggalkan, serta tidak boleh berada di lingkungan sekolah dan sekitarnya selama dalam masa skorsing.

Apabila diketahui berada di lingkungan sekolah dalam masa skorsing maka skorsing ditambah 1 hari.

Demikianlah surat pemberitahuan ini. Atas perhatian bapak/ibu kami ucapkan terima kasih.

Billahit Taufiq Walhidayah
Wassalamu'alaikum Wr.Wb

${ttdTwo("Ketahanan Sekolah", "Wali Kelas")}

Mengetahui,
${ttdOne("Kepala {{sekolah}}", "{{kepala_sekolah}}")}`,
  },
];
