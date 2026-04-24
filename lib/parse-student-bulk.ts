/** Baris untuk API /api/students/bulk — kelas bisa id atau nama persis di database. */
export type ParsedBulkStudent = {
  name: string;
  nisn: string;
  classId?: string;
  className?: string;
  email?: string;
  password?: string;
};

function splitLine(line: string): string[] {
  const delim = line.includes("\t") ? "\t" : ",";
  return line.split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
}

function headerIndex(headerCells: string[], keys: string[]): number {
  const lower = headerCells.map((c) => c.toLowerCase().replace(/\s+/g, "_"));
  for (const key of keys) {
    const k = key.toLowerCase();
    const i = lower.findIndex((c) => c === k || c.replace(/_/g, "") === k.replace(/_/g, ""));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Parse teks dari Excel (tab) atau CSV (koma).
 * Mendukung baris judul: nama, nisn, kelas, email, password (nama_kelas / class_name / id_kelas).
 */
export function parseStudentBulkPaste(raw: string): ParsedBulkStudent[] {
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const first = splitLine(lines[0]);
  const lower0 = first.map((c) => c.toLowerCase());
  const looksHeader =
    lower0.includes("nama") ||
    lower0.includes("nisn") ||
    lower0.includes("name") ||
    lower0.includes("kelas") ||
    lower0.includes("class");

  let header: string[] = [];
  let dataLines = lines;
  if (looksHeader) {
    header = first.map((c) => c.toLowerCase().replace(/\s+/g, "_"));
    dataLines = lines.slice(1);
  }

  const out: ParsedBulkStudent[] = [];

  for (const line of dataLines) {
    const cells = splitLine(line);
    if (cells.every((c) => !c)) continue;

    let name: string;
    let nisn: string;
    let classId: string | undefined;
    let className: string | undefined;
    let email: string | undefined;
    let password: string | undefined;

    if (looksHeader && header.length) {
      const gi = (...keys: string[]) => {
        const i = headerIndex(header, keys);
        if (i >= 0 && cells[i] !== undefined) return cells[i];
        return "";
      };
      name = gi("nama", "name", "nama_siswa", "nama_lengkap");
      nisn = gi("nisn", "nis", "nomor_induk");
      const cid = gi("id_kelas", "classid", "class_id", "kelas_id");
      const cname = gi("kelas", "nama_kelas", "class", "class_name", "nama kelas");
      classId = cid || undefined;
      className = cname || undefined;
      email = gi("email", "surel") || undefined;
      password = gi("password", "kata_sandi", "katasandi") || undefined;
    } else {
      name = cells[0] || "";
      nisn = cells[1] || "";
      const third = cells[2] || "";
      if (third.startsWith("cls-") || third.length > 20) {
        classId = third;
      } else {
        className = third || undefined;
      }
      email = cells[3] || undefined;
      password = cells[4] || undefined;
    }

    if (name && nisn) {
      out.push({ name, nisn, classId, className, email, password });
    }
  }

  return out;
}

export function bulkImportTemplateTsv(): string {
  return ["nama\tnisn\tnama_kelas\temail\tpassword", "Contoh Siswa\t0012345678\tX MIPA 1\t\t"].join("\n");
}
