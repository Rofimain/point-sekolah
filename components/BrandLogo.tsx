import Image from "next/image";
import { cn } from "@/lib/utils";

export const BRAND_LOGO_ALT = "Yayasan Pesantren Islam Al Azhar";

export function BrandLogo({
  size,
  className,
  priority,
}: {
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand-logo.png"
      alt={BRAND_LOGO_ALT}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn("shrink-0 rounded-full object-cover object-center ring-1 ring-black/[0.06]", className)}
      priority={priority}
    />
  );
}
