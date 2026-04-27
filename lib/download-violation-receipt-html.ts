export type ReceiptDetailRow = { label: string; value: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `bukti-pelanggaran-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.html`;
}

/**
 * Mengunduh berkas HTML mandiri (bisa dibuka di browser, dicetak, atau disimpan sebagai PDF lewat Print).
 */
export function downloadViolationReceiptHtml(opts: {
  schoolName: string;
  title: string;
  subtitle: string;
  details: ReceiptDetailRow[];
  /** Nama file unduhan (tanpa path). */
  filename?: string;
}): void {
  const { schoolName, title, subtitle, details, filename = defaultFilename() } = opts;
  const rows = details
    .map(
      (d) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;width:38%;vertical-align:top">${escapeHtml(d.label)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:600;color:#111827;vertical-align:top">${escapeHtml(d.value)}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ${escapeHtml(schoolName)}</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; background: #f3f4f6; color: #111827; }
    .card { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 28px 24px 24px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .badge { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(145deg, #34d399, #059669); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
    .badge svg { width: 28px; height: 28px; stroke: #fff; stroke-width: 2.5; fill: none; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; text-align: center; }
    .sub { font-size: 0.875rem; color: #6b7280; text-align: center; line-height: 1.5; margin: 0 0 20px; }
    .school { font-size: 0.75rem; color: #9ca3af; text-align: center; margin-bottom: 20px; letter-spacing: .02em; }
    table { width: 100%; border-collapse: collapse; }
    .foot { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.5; }
    @media print { body { background: #fff; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="school">${escapeHtml(schoolName)}</div>
    <div class="badge"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${escapeHtml(subtitle)}</p>
    <table><tbody>${rows}</tbody></table>
    <p class="foot">Dokumen ini dihasilkan dari sistem tata tertib sekolah. Untuk PDF: buka file ini lalu gunakan Cetak → Simpan sebagai PDF.</p>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
