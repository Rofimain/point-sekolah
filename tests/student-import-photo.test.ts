import test from "node:test";
import assert from "assert/strict";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import {
  imageBufferToPhotoDataUrl,
  nisnFromPhotoFilename,
  parseUserPhotoInput,
} from "../lib/user-photo";
import { parseStudentImportPackage } from "../lib/parse-student-import-package";
import { scoreNamePhotoMatch } from "../lib/student-photo-match";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("nisnFromPhotoFilename extracts stem", () => {
  assert.equal(nisnFromPhotoFilename("foto/0012345678.jpg"), "0012345678");
  assert.equal(nisnFromPhotoFilename("0012345678.PNG"), "0012345678");
  assert.equal(nisnFromPhotoFilename("readme.txt"), null);
});

test("imageBufferToPhotoDataUrl accepts PNG", () => {
  const r = imageBufferToPhotoDataUrl(PNG_1X1);
  assert.ok(!("error" in r));
  assert.equal(r.photoPresent, true);
  assert.ok(r.photoData.startsWith("data:image/png;base64,"));
  const parsed = parseUserPhotoInput(r.photoData);
  assert.ok(!("error" in parsed));
  assert.equal(parsed.photoPresent, true);
});

test("scoreNamePhotoMatch accepts initials and truncation", () => {
  const full = "Ahmad Fauzi Muharrom";
  assert.ok((scoreNamePhotoMatch("ahmad fauzi muharrom", full) ?? 0) > 0);
  assert.ok((scoreNamePhotoMatch("ahmad fauzi m", full) ?? 0) > 0);
  assert.ok((scoreNamePhotoMatch("ahmad fauzi", full) ?? 0) > 0);
  assert.ok((scoreNamePhotoMatch("Ahmad_Fauzi_M", full) ?? 0) > 0);
  assert.equal(scoreNamePhotoMatch("budi santoso", full), null);
  // Nama lebih spesifik menang dari yang dipotong
  const exact = scoreNamePhotoMatch("ahmad fauzi muharrom", full)!;
  const short = scoreNamePhotoMatch("ahmad fauzi", full)!;
  assert.ok(exact > short);
});

test("parseStudentImportPackage maps ZIP photos by NISN", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data siswa");
  ws.addRow(["nama", "nisn", "nama_kelas"]);
  ws.addRow(["Budi", "0012345678", "X MIPA 1"]);
  ws.addRow(["Ani", "0098765432", "X MIPA 1"]);
  const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());

  const zip = new JSZip();
  zip.file("data.xlsx", xlsxBuf);
  zip.file("foto/0012345678.png", PNG_1X1);
  zip.file("foto/9999999999.png", PNG_1X1);
  const zipBuf = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

  const parsed = await parseStudentImportPackage(zipBuf);
  assert.equal(parsed.rows.length, 2);
  assert.ok(parsed.rows[0].photoData?.startsWith("data:image/png"));
  assert.equal(parsed.rows[1].photoData, undefined);
  assert.deepEqual(parsed.unmatchedPhotos, ["9999999999"]);
});

test("parseStudentImportPackage maps ZIP photos by abbreviated name", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data siswa");
  ws.addRow(["nama", "email", "nama_kelas"]);
  ws.addRow(["Ahmad Fauzi Muharrom", "ahmad@siswa.id", "X MIPA 1"]);
  ws.addRow(["Budi Santoso", "budi@siswa.id", "X MIPA 1"]);
  const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());

  const zip = new JSZip();
  zip.file("data.xlsx", xlsxBuf);
  zip.file("foto/ahmad fauzi m.png", PNG_1X1);
  zip.file("foto/budi.png", PNG_1X1);
  const zipBuf = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

  const parsed = await parseStudentImportPackage(zipBuf);
  assert.equal(parsed.rows.length, 2);
  assert.ok(parsed.rows[0].photoData?.startsWith("data:image/png"));
  assert.ok(parsed.rows[1].photoData?.startsWith("data:image/png"));
  assert.deepEqual(parsed.unmatchedPhotos, []);
});

test("parseStudentImportPackage accepts bare xlsx", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data siswa");
  ws.addRow(["nama", "nisn", "nama_kelas"]);
  ws.addRow(["Budi", "0012345678", "X MIPA 1"]);
  const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());
  const parsed = await parseStudentImportPackage(xlsxBuf);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].name, "Budi");
  assert.equal(parsed.rows[0].photoData, undefined);
});
