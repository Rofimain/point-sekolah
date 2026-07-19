import { getInitials } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  userId?: string;
  photoPresent?: boolean;
  /** Preview lokal (data URL) — mengalahkan foto tersimpan */
  previewSrc?: string | null;
  /** Bust cache setelah ganti foto (mis. updatedAt ISO) */
  cacheKey?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  rounded?: "full" | "lg" | "xl";
};

const SIZE = {
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[10px]",
  lg: "h-14 w-14 text-xs sm:h-16 sm:w-16 sm:text-sm",
  xl: "h-16 w-16 text-sm sm:h-20 sm:w-20 sm:text-base",
  "2xl": "h-20 w-20 text-base sm:h-24 sm:w-24 sm:text-lg",
} as const;

const ROUND = {
  full: "rounded-full",
  lg: "rounded-lg",
  xl: "rounded-xl",
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
  const round = ROUND[rounded];
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
        className={`${SIZE[size]} ${round} object-cover object-center flex-shrink-0 ${className}`}
        style={{ background: "var(--bg-tertiary)", aspectRatio: "1 / 1" }}
      />
    );
  }

  return (
    <div
      className={`${SIZE[size]} ${round} flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ background: "var(--accent-light)", color: "var(--accent)", aspectRatio: "1 / 1" }}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
