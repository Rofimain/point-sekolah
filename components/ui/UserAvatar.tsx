"use client";

import { getInitials } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  userId?: string;
  photoPresent?: boolean;
  /** Preview lokal (data URL) — mengalahkan foto tersimpan */
  previewSrc?: string | null;
  /** Bust cache setelah ganti foto (mis. updatedAt ISO) */
  cacheKey?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  rounded?: "full" | "lg";
};

const SIZE = {
  sm: "w-6 h-6 text-[9px]",
  md: "w-8 h-8 text-[10px]",
  lg: "w-16 h-16 text-sm",
} as const;

export default function UserAvatar({
  name,
  userId,
  photoPresent,
  previewSrc,
  cacheKey,
  size = "sm",
  className = "",
  rounded = "full",
}: UserAvatarProps) {
  const round = rounded === "full" ? "rounded-full" : "rounded-lg";
  const stored =
    photoPresent && userId
      ? `/api/users/${encodeURIComponent(userId)}/photo${cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ""}`
      : null;
  const src = (previewSrc?.trim() || null) ?? stored;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${SIZE[size]} ${round} object-cover flex-shrink-0 ${className}`}
        style={{ background: "var(--bg-tertiary)" }}
      />
    );
  }

  return (
    <div
      className={`${SIZE[size]} ${round} flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ background: "var(--accent-light)", color: "var(--accent)" }}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
