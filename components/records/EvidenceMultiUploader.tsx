"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  compressImageToDataUrl,
  EVIDENCE_COMPRESS_OPTIONS,
  isProbablyImageFile,
  MAX_EVIDENCE_IMAGES,
} from "@/lib/compress-image-client";

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
};

export function EvidenceMultiUploader({ images, onChange, disabled, label = "Foto bukti", hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = "evidence-multi-uploader-input";
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, MAX_EVIDENCE_IMAGES - images.length);

  async function processFiles(fileList: FileList | File[] | null) {
    if (!fileList || disabled) return;
    const files = Array.from(fileList).filter(Boolean);
    if (files.length === 0) return;

    const slots = remaining;
    if (slots <= 0) {
      toast.error(`Maksimal ${MAX_EVIDENCE_IMAGES} foto bukti.`);
      return;
    }

    const selected = files.slice(0, slots);
    if (files.length > slots) {
      toast.message(`Hanya ${slots} foto lagi yang bisa ditambahkan (maks. ${MAX_EVIDENCE_IMAGES}).`);
    }

    for (const file of selected) {
      if (!isProbablyImageFile(file)) {
        toast.error(`${file.name}: gunakan file gambar (JPG, PNG, HEIC, WebP, dll.).`);
        return;
      }
    }

    setBusy(true);
    try {
      const next = [...images];
      await toast.promise(
        (async () => {
          let totalKb = 0;
          for (const file of selected) {
            const { dataUrl, meta } = await compressImageToDataUrl(file, EVIDENCE_COMPRESS_OPTIONS);
            next.push(dataUrl);
            totalKb += meta.outputBytes;
          }
          onChange(next);
          return { count: selected.length, kb: Math.max(1, Math.round(totalKb / 1024)) };
        })(),
        {
          loading: selected.length > 1 ? `Mengompres ${selected.length} foto…` : "Mengompres foto…",
          success: (r) => (r.count > 1 ? `${r.count} foto siap (total ~${r.kb} KB)` : `Foto siap (~${r.kb} KB)`),
          error: (err: unknown) => (err instanceof Error ? err.message : "Gagal memproses gambar"),
        }
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
        {images.length > 0 ? ` (${images.length}/${MAX_EVIDENCE_IMAGES})` : ""}
      </label>
      <p className="mb-2 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {hint ??
          `Bisa pilih beberapa foto (maks. ${MAX_EVIDENCE_IMAGES}). Otomatis dikompres ~800 KB/foto agar teks tetap terbaca.`}
      </p>

      {images.length > 0 ? (
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((src, index) => (
            <div
              key={`${index}-${src.slice(0, 32)}`}
              className="relative rounded-lg border"
              style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
            >
              <img
                src={src}
                alt={`Foto bukti pelanggaran ${index + 1}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {index + 1}
              </span>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => removeAt(index)}
                className="absolute right-1 top-1 inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg bg-black/65 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                aria-label={`Hapus foto bukti ${index + 1}`}
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        disabled={disabled || busy || remaining <= 0}
        className="w-full text-xs"
        onChange={(e) => void processFiles(e.target.files)}
      />
    </div>
  );
}
