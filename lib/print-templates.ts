import { SCHOOL_NAME, SCHOOL_NAME_SHORT } from "@/lib/branding";

export type PrintTemplateSeed = {
  slug: string;
  title: string;
  body: string;
  sortOrder: number;
};

/** Naikkan versi ini bila layout default template diubah (satu kali sync ke DB). */
export const PRINT_TEMPLATES_LAYOUT_VERSION = "12";

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
    "kepala_sekolah",
  ],
  "perjanjian-khusus": ["nama", "kelas", "alamat", "jenis_sp", "poin", "tanggal_perjanjian"],
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
    slug && TEMPLATE_OFFICIAL_PLACEHOLDERS[slug] ? new Set(TEMPLATE_OFFICIAL_PLACEHOLDERS[slug]) : ALL_OFFICIAL_KEYS;
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

/** Blok tanda tangan HTML (mirip Word) — tabel, bukan padding monospace / div kosong. */
const TTD_SIGN_LINE = "_______________";

function ttdOne(role: string, name: string): string {
  return `<table class="doc-sign-table doc-sign-one-table"><tbody><tr>
<td class="doc-sign-cell">
<p class="doc-sign-role">${role}</p>
<p class="doc-sign-space">&nbsp;</p>
<p class="doc-sign-name"><strong>${name}</strong></p>
</td>
</tr></tbody></table>`;
}

function ttdTwo(leftRole: string, rightRole: string, leftName = TTD_SIGN_LINE, rightName = TTD_SIGN_LINE): string {
  return `<table class="doc-sign-table"><tbody><tr>
<td class="doc-sign-cell">
<p class="doc-sign-role">${leftRole}</p>
<p class="doc-sign-space">&nbsp;</p>
<p class="doc-sign-name"><strong>${leftName}</strong></p>
</td>
<td class="doc-sign-cell">
<p class="doc-sign-role">${rightRole}</p>
<p class="doc-sign-space">&nbsp;</p>
<p class="doc-sign-name"><strong>${rightName}</strong></p>
</td>
</tr></tbody></table>`;
}

function ttdThree(a: string, b: string, c: string): string {
  return `<table class="doc-sign-table"><tbody><tr>
<td class="doc-sign-cell"><p class="doc-sign-role">${a}</p><p class="doc-sign-space">&nbsp;</p><p class="doc-sign-name"><strong>${TTD_SIGN_LINE}</strong></p></td>
<td class="doc-sign-cell"><p class="doc-sign-role">${b}</p><p class="doc-sign-space">&nbsp;</p><p class="doc-sign-name"><strong>${TTD_SIGN_LINE}</strong></p></td>
<td class="doc-sign-cell"><p class="doc-sign-role">${c}</p><p class="doc-sign-space">&nbsp;</p><p class="doc-sign-name"><strong>${TTD_SIGN_LINE}</strong></p></td>
</tr></tbody></table>`;
}

function letterMeta(rows: { label: string; value: string }[], dateRight?: string): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td class="doc-meta-label">${r.label}</td><td class="doc-meta-colon">:</td><td class="doc-meta-value">${r.value}</td></tr>`
    )
    .join("");
  if (dateRight) {
    return `<table class="doc-letterhead-meta"><tbody><tr>
<td class="doc-meta-left"><table class="doc-meta-table"><tbody>${body}</tbody></table></td>
<td class="doc-meta-right">${dateRight}</td>
</tr></tbody></table>`;
  }
  return `<table class="doc-meta-table"><tbody>${body}</tbody></table>`;
}

export const DEFAULT_PRINT_TEMPLATES: PrintTemplateSeed[] = [
  {
    slug: "sp1",
    title: "Surat Peringatan 1 (SP1)",
    sortOrder: 10,
    body: `${letterMeta(
      [
        { label: "Nomor", value: "{{nomor_surat}}" },
        { label: "Lamp.", value: "1 berkas" },
        { label: "Perihal", value: "SP1" },
      ],
      "{{tanggal}}"
    )}
<p class="doc-title">SURAT PERINGATAN PERTAMA (SP1)</p>
<p>Assalamu'alaikum Wr.Wb.</p>
<p>Sehubungan dengan akumulasi pelanggaran tata tertib ananda :</p>
<table class="doc-identity-table"><tbody>
<tr><td>Nama</td><td class="doc-meta-colon">:</td><td>{{nama}}</td></tr>
<tr><td>Kelas</td><td class="doc-meta-colon">:</td><td>{{kelas}}</td></tr>
<tr><td>Nomor Induk</td><td class="doc-meta-colon">:</td><td>{{nis}}</td></tr>
</tbody></table>
<p>telah mencapai akumulasi poin pelanggaran tata tertib sekolah sebanyak {{poin}} poin ({{poin_terbilang}}) yang tercatat sebagai berikut :</p>
<p>{{daftar_pelanggaran}}</p>
<p>Surat peringatan pertama ini diberikan sebagai peringatan awal agar diperhatikan dan menjadi pengingat agar tidak mengulangi perbuatan yang melanggar tata tertib sekolah lagi. Surat SP1 ini sebagai catatan dan berlaku selama menjadi murid ${SCHOOL_NAME}.</p>
<p>Demikian Surat Peringatan 1 (SP 1) ini di buat agar menjadi perhatian dan perbaikan.</p>
<p>Wassalamualaikum Wr.Wb.</p>
${ttdOne("Kepala " + SCHOOL_NAME, "{{kepala_sekolah}}")}`,
  },
  {
    slug: "sp2",
    title: "Surat Peringatan 2 (SP2)",
    sortOrder: 20,
    body: `${letterMeta(
      [
        { label: "Nomor", value: "{{nomor_surat}}" },
        { label: "Lamp.", value: "1 berkas" },
        { label: "Perihal", value: "SP 2" },
      ],
      "{{tanggal}}"
    )}
<p class="doc-title">SURAT PERINGATAN Ke-2 (SP-2)</p>
<p>Assalamualaikum wr wb.</p>
<p>Sehubungan dengan akumulasi pelanggaran tata tertib ananda :</p>
<table class="doc-identity-table"><tbody>
<tr><td>Nama</td><td class="doc-meta-colon">:</td><td>{{nama}}</td></tr>
<tr><td>Kelas</td><td class="doc-meta-colon">:</td><td>{{kelas}}</td></tr>
<tr><td>Nomor Induk</td><td class="doc-meta-colon">:</td><td>{{nis}}</td></tr>
</tbody></table>
<p>telah mencapai akumulasi poin pelanggaran tata tertib sekolah sebanyak {{poin}} ({{poin_terbilang}}) yang tercatat sebagai berikut :</p>
<p>{{daftar_pelanggaran}}</p>
<p>Surat peringatan ke-2 ini diberikan agar diperhatikan dan menjadi pengingat agar tidak mengulangi perbuatan yang melanggar tata tertib sekolah lagi. Surat SP-2 ini sebagai catatan dan berlaku selama menjadi murid ${SCHOOL_NAME}.</p>
<p>Demikian surat Peringatan Ke-2 (SP 2) ini di buat agar menjadi perhatian dan perbaikan.</p>
<p>Wassalamualaikum wr.wb.</p>
${ttdOne("Kepala " + SCHOOL_NAME, "{{kepala_sekolah}}")}`,
  },
  {
    slug: "sp3",
    title: "Surat Peringatan 3 (SP3)",
    sortOrder: 30,
    body: `${letterMeta(
      [
        { label: "Nomor", value: "{{nomor_surat}}" },
        { label: "Lamp.", value: "-" },
        { label: "Perihal", value: "SP3" },
      ],
      "{{tanggal}}"
    )}
<p class="doc-title">SURAT PERINGATAN KETIGA (SP3)</p>
<p class="doc-subtitle">(Peringatan terakhir)</p>
<p>Assalamu'alaikum Warrohmatullohi Wabarakatuh.</p>
<p>Sehubungan dengan akumulasi pelanggaran tata tertib ananda yang bernama :</p>
<table class="doc-identity-table"><tbody>
<tr><td>Nama</td><td class="doc-meta-colon">:</td><td>{{nama}}</td></tr>
<tr><td>Kelas</td><td class="doc-meta-colon">:</td><td>{{kelas}}</td></tr>
<tr><td>Nomor Induk</td><td class="doc-meta-colon">:</td><td>{{nis}}</td></tr>
</tbody></table>
<p>telah melakukan akumulasi pelanggaran tata tertib sekolah berupa:</p>
<p>{{daftar_pelanggaran}}</p>
<p>Total point yang terakumulasi = {{poin}} ({{poin_terbilang}})</p>
<p>Surat peringatan ke-3 (ketiga) ini diberikan sebagai peringatan terakhir yang wajib diperhatikan dan dipatuhi/ditaati. Apabila di kemudian hari dimulai dari tanggal diterbitkan surat SP-3 ini, terjadi perbuatan pelanggaran tata tertib lagi baik pada pasal yang sama maupun pada pasal berbeda maka sanksi yang diberikan berupa dikembalikan ke orang tua atau dikeluarkan dari ${SCHOOL_NAME}.</p>
<p>Demikian Surat Peringatan ke-3 (SP 3) ini di buat agar diperhatikan dan wajib dipatuhi/taati.</p>
<p>Wassalamu'alaikum Warrohmatullohi Wabarokaatuh.</p>
${ttdOne("Kepala " + SCHOOL_NAME, "{{kepala_sekolah}}")}`,
  },
  {
    slug: "info-poin",
    title: "Surat Info Poin",
    sortOrder: 40,
    body: `${letterMeta(
      [{ label: "Hal", value: "Informasi poin ke-{{urutan_poin}} pelanggaran tata-tertib" }],
      "{{tanggal}}"
    )}
<p>Kepada Yth.<br/>Bapak/Ibu Orang Tua Murid<br/>Ananda {{nama}} ({{kelas}})<br/>${SCHOOL_NAME}<br/>di- Jakarta</p>
<p>Assalamualaikum Wr. Wb.</p>
<p>Salam ta'zim kami sampaikan semoga kita semua senantiasa berada dalam lindungan Allah SWT serta sukses dalam menjalankan tugas sehari – hari, Aamiin Yaa Robbal'aalamiin.</p>
<p>Dengan surat ini kami beritahukan bahwa terhitung mulai {{periode_awal}} hingga {{periode_akhir}} poin pelanggaran tata tertib Ananda di sekolah sudah mencapai {{poin}} poin.</p>
<p>Besar harapan kami masalah ini dapat teratasi karena jika poin Ananda bertambah lagi 1 poin saja karena pelanggaran tata tertib ataupun yang berdampak pada penambahan poin, maka sesuai dengan tata tertib sekolah maka Ananda akan diberikan Surat Peringatan 1 (SP1) dan di kenakan sanksi skorsing minimal 2 hari efektif sekolah.</p>
<p>Jika Ananda tidak melakukan pelanggaran tata tertib kembali sampai tanggal {{batas_remisi}} maka Ananda akan mendapat remisi/pengurangan poin sebesar 25% dari total poin.</p>
<p>Demikian surat informasi dari kami, atas perhatian Bapak/Ibu kami ucapkan terima kasih.</p>
<p>Billahit Taufiq Walhidayah<br/>Wassalamu 'alaikum Wr. Wb.</p>
${ttdTwo("Kepala " + SCHOOL_NAME, "Mengetahui<br/>Orangtua Murid", "{{kepala_sekolah}}", "................................")}
<p class="doc-note">Catatan : Surat ini di kembalikan ke sekolah setelah di tandatangani oleh orangtua murid paling lambat 2 hari sejak tanggal pemberian surat.</p>`,
  },
  {
    slug: "pemanggilan-otm",
    title: "Surat Pemanggilan OTM",
    sortOrder: 50,
    body: `${letterMeta(
      [
        { label: "Nomor", value: "{{nomor_surat}}" },
        { label: "Lamp", value: "-" },
      ],
      "{{tanggal}}"
    )}
<p>Kepada<br/>Yth. Bapak &amp; Ibu Orang Tua<br/>Ananda {{nama}} ({{kelas}})<br/>${SCHOOL_NAME}<br/>di- Jakarta</p>
<p>Assalamu 'alaikum Wr. Wb.</p>
<p>Salam ta'zim kami sampaikan semoga kita semua senantiasa berada dalam lindungan Allah SWT serta sukses dalam menjalankan tugas sehari – hari, Aamiin Yaa Robbal'aalamiin.</p>
<p>Sehubungan dengan kondisi akumulasi poin pelanggaran Ananda {{nama}} sampai saat ini sudah mencapai {{poin}} poin. Kami mengharapkan kehadiran Bapak / Ibu pada</p>
<table class="doc-identity-table"><tbody>
<tr><td>hari/tanggal</td><td class="doc-meta-colon">:</td><td>{{hari_tanggal_pertemuan}}</td></tr>
<tr><td>waktu</td><td class="doc-meta-colon">:</td><td>{{waktu_pertemuan}}</td></tr>
<tr><td>tempat</td><td class="doc-meta-colon">:</td><td>{{tempat}}</td></tr>
<tr><td>menemui</td><td class="doc-meta-colon">:</td><td>{{nama_pic}}</td></tr>
<tr><td>Untuk membicarakan</td><td class="doc-meta-colon">:</td><td>{{materi_diskusi}}</td></tr>
</tbody></table>
<p>Demikian surat ini kami sampaikan, atas perhatian dan kesediaan Bapak/Ibu untuk hadir, kami ucapkan terima kasih.</p>
<p>Billahit Taufiq Walhidayah<br/>Wassalamu 'alaikum Wr. Wb.</p>
${ttdOne("Kepala " + SCHOOL_NAME, "{{kepala_sekolah}}")}
<p class="doc-note">Catatan :<br/>Harap hadir sesuai dengan waktu yang telah di tentukan.</p>`,
  },
  {
    slug: "perjanjian-khusus",
    title: "Surat Perjanjian Khusus",
    sortOrder: 60,
    body: `<p class="doc-title">SURAT PERJANJIAN KHUSUS</p>
<p>Yang bertanda tangan dibawah ini adalah :</p>
<table class="doc-identity-table"><tbody>
<tr><td>Nama</td><td class="doc-meta-colon">:</td><td>{{nama}}</td></tr>
<tr><td>Kelas</td><td class="doc-meta-colon">:</td><td>{{kelas}}</td></tr>
<tr><td>Alamat</td><td class="doc-meta-colon">:</td><td>{{alamat}}</td></tr>
</tbody></table>
<p>Menyatakan, bahwa saya telah menerima {{jenis_sp}} karena akumulasi poin sejumlah : {{poin}} poin karena melanggar tata tertib sekolah seperti yang tercantum dalam lampiran info poin.</p>
<p>Untuk itu saya berjanji :</p>
<ol>
<li>Tidak akan melanggar tata tertib sekolah lagi dan akan mentaatinya</li>
<li>Akan belajar sebaik-baiknya</li>
<li>Akan selalu menjaga nama baik sendiri, keluarga dan sekolah.</li>
</ol>
<p>Apabila dikemudian hari saya masih melakukan pelanggaran tata tertib sekolah lagi maka saya bersedia menerima sanksi sesuai dengan tata tertib yang berlaku berupa:</p>
<ol>
<li>Pelanggaran yang sama berdampak dikembalikan kepada orang tua (dikeluarkan dari sekolah)</li>
<li>Pelanggaran yang berdampak poin dapat menambah jumlah poin sehingga dikembalikan kepada orang tua (dikeluarkan dari sekolah)</li>
</ol>
<p>Demikianlah surat perjanjian ini saya buat dengan penuh kesadaran dan kesungguhan.</p>
<p>{{tanggal_perjanjian}}</p>
<p>Menyaksikan,</p>
${ttdThree("Wali kelas", "Orangtua/wali murid", "saya yang berjanji")}
<p class="doc-note">Materai Rp. 10.000,-</p>
<p>Mengetahui,</p>
${ttdThree("Kepala " + SCHOOL_NAME_SHORT, "Korbid Tanse", "Bimb. Konseling")}`,
  },
  {
    slug: "skorsing",
    title: "Surat Skorsing",
    sortOrder: 70,
    body: `${letterMeta(
      [
        { label: "Nomor", value: "{{nomor_surat}}" },
        { label: "Lampiran", value: "1" },
        { label: "Hal", value: "Sanksi Belajar Di Rumah" },
      ],
      "{{tanggal_hijriah}}<br/>{{tanggal_masehi}}"
    )}
<p>Kepada Yth :<br/>Bapak dan Ibu Orang Tua<br/>Ananda {{nama}} ({{kelas}})<br/>di Tempat</p>
<p>Assalamu'alaikum Wr.Wb.</p>
<p>Bersama ini kami sampaikan bahwa putra/putri bapak/ibu yang bernama: {{nama}} kelas {{kelas}} telah melanggar tata tertib sekolah Pasal {{pasal}} yang berbunyi : {{bunyi_pasal}}.</p>
<p>Sesuai tata tertib sekolah, putra/putri bapak ibu diberikan sanksi belajar di rumah selama : {{lama_skorsing}} hari, tanggal {{tanggal_mulai_skorsing}}. Putra/putri bapak/ibu mulai sekolah kembali pada tanggal {{tanggal_masuk_kembali}}.</p>
<p>Selama belajar di rumah putra/putri bapak/ibu ditugaskan untuk mengerjakan tugas-tugas yang dia minta kepada guru yang bersangkutan dengan pelajaran yang ditinggalkan, serta tidak boleh berada di lingkungan sekolah dan sekitarnya selama dalam masa skorsing.</p>
<p>Apabila diketahui berada di lingkungan sekolah dalam masa skorsing maka skorsing ditambah 1 hari.</p>
<p>Demikianlah surat pemberitahuan ini. Atas perhatian bapak/ibu kami ucapkan terima kasih.</p>
<p>Billahit Taufiq Walhidayah<br/>Wassalamu'alaikum Wr.Wb</p>
${ttdTwo("Ketahanan Sekolah", "Wali Kelas")}
<p>Mengetahui</p>
${ttdOne("Kepala " + SCHOOL_NAME, "{{kepala_sekolah}}")}`,
  },
];
