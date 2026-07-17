import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { SCHOOL_NAME } from "@/lib/branding";
import { parseEvidenceImageDataUrl } from "@/lib/evidence-data-url";

export type ViolationEvidencePdfRecord = {
  id: string;
  student: { name: string; nisn: string | null; class: { name: string } | null };
  violationType: { name: string };
  points: number;
  session: string | null;
  notes: string | null;
  date: Date;
  createdAt: Date;
  createdByName: string | null;
  evidenceImageData?: string | null;
  evidenceImages?: string[] | null;
  studentSignatureData: string | null;
};

function printable(value: string | null | undefined) {
  return (value?.trim() || "—")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of printable(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line || " ");
  }
  return lines;
}

async function embedImage(pdf: PDFDocument, dataUrl: string | null): Promise<PDFImage | null> {
  if (!dataUrl?.trim()) return null;
  const parsed = parseEvidenceImageDataUrl(dataUrl);
  return parsed.mime === "image/png" ? pdf.embedPng(parsed.bytes) : pdf.embedJpg(parsed.bytes);
}

export async function createViolationEvidencePdf(record: ViolationEvidencePdfRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensureSpace = (height: number) => {
    if (y - height >= margin) return;
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };
  const drawTextLines = (text: string, options?: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number }) => {
    const font = options?.font ?? regular;
    const size = options?.size ?? 10;
    const gap = options?.gap ?? 4;
    const lines = wrapText(text, font, size, contentWidth);
    ensureSpace(lines.length * (size + gap));
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size, font, color: options?.color ?? rgb(0.12, 0.12, 0.12) });
      y -= size + gap;
    }
  };
  const drawField = (label: string, value: string | null | undefined) => {
    ensureSpace(32);
    page.drawText(printable(label).toUpperCase(), { x: margin, y, size: 7.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
    y -= 12;
    drawTextLines(printable(value), { size: 10, gap: 3 });
    y -= 5;
  };

  drawTextLines(SCHOOL_NAME, { font: bold, size: 15, color: rgb(0.05, 0.35, 0.25), gap: 5 });
  drawTextLines("BUKTI LAPORAN PELANGGARAN", { font: bold, size: 12, gap: 5 });
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;

  drawField("Nama siswa", record.student.name);
  drawField("NISN / kelas", [record.student.nisn, record.student.class?.name].filter(Boolean).join(" / "));
  drawField("Pelanggaran", record.violationType.name);
  drawField("Poin", `${record.points} poin`);
  drawField("Tanggal kejadian", record.date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }));
  drawField("Sesi", record.session);
  drawField("Diinput oleh", record.createdByName);
  drawField("Keterangan", record.notes);

  const evidenceList =
    Array.isArray(record.evidenceImages) && record.evidenceImages.length > 0
      ? record.evidenceImages.filter((s) => typeof s === "string" && s.trim())
      : record.evidenceImageData?.trim()
        ? [record.evidenceImageData.trim()]
        : [];

  for (let i = 0; i < evidenceList.length; i++) {
    const evidence = await embedImage(pdf, evidenceList[i]);
    if (!evidence) continue;
    ensureSpace(250);
    const label = evidenceList.length > 1 ? `FOTO BUKTI (${i + 1}/${evidenceList.length})` : "FOTO BUKTI";
    page.drawText(label, { x: margin, y, size: 7.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
    y -= 14;
    const dimensions = evidence.scaleToFit(contentWidth, Math.min(330, y - margin));
    page.drawImage(evidence, { x: margin, y: y - dimensions.height, width: dimensions.width, height: dimensions.height });
    y -= dimensions.height + 18;
  }

  const signature = record.studentSignatureData?.trim();
  if (signature) {
    ensureSpace(90);
    page.drawText("PENGAKUAN / TANDA TANGAN", { x: margin, y, size: 7.5, font: bold, color: rgb(0.42, 0.42, 0.42) });
    y -= 14;
    if (signature.startsWith("data:")) {
      const image = await embedImage(pdf, signature);
      if (image) {
        const dimensions = image.scaleToFit(contentWidth, Math.min(150, y - margin));
        page.drawImage(image, { x: margin, y: y - dimensions.height, width: dimensions.width, height: dimensions.height });
        y -= dimensions.height;
      }
    } else {
      drawTextLines(signature, { size: 10, gap: 4 });
    }
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage: PDFPage, index) => {
    pdfPage.drawText(`ID: ${printable(record.id)} | Halaman ${index + 1}/${pages.length}`, {
      x: margin,
      y: 24,
      size: 7,
      font: regular,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
  pdf.setTitle(`Bukti pelanggaran - ${printable(record.student.name)}`);
  pdf.setAuthor(SCHOOL_NAME);
  return pdf.save();
}

export function evidencePdfFilename(studentName: string, recordId: string) {
  const slug = studentName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "siswa";
  return `bukti-pelanggaran-${slug}-${recordId.slice(-8)}.pdf`;
}
