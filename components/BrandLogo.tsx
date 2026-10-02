import Image from "next/image";
import { cn } from "@/lib/utils";

export const BRAND_LOGO_ALT = "Yayasan Pesantren Islam Al Azhar";

export function BrandLogo({
  size,
  className,
  priority,
  variant = "plain",
}: {
  size: number;
  className?: string;
  priority?: boolean;
  variant?: "plain" | "seal";
}) {
  const image = (
    <Image
      src="/brand-logo.png"
      alt={BRAND_LOGO_ALT}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn(
        "shrink-0 rounded-full object-cover object-center",
        variant === "plain" && "ring-1 ring-black/[0.06]",
        variant === "seal" && "h-full w-full",
        variant === "plain" && className
      )}
      priority={priority}
    />
  );

  if (variant !== "seal") return image;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full p-[2px]", className)}
      style={{
        width: size,
        height: size,
        background: "#fff",
        boxShadow:
          "0 0 0 1px color-mix(in srgb, var(--gold) 55%, transparent), 0 0 0 4px var(--bg-secondary), 0 2px 8px rgba(14,23,38,.10)",
      }}
    >
      {image}
    </span>
  );
}
