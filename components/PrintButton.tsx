"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print px-4 py-2 rounded-lg text-sm font-semibold text-white"
      style={{ background: "var(--accent)" }}
    >
      Cetak / Simpan PDF
    </button>
  );
}
