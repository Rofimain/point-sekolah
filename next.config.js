/** @type {import('next').NextConfig} */

/**
 * Host (tanpa protokol) untuk serverActions.allowedOrigins.
 * Ambil dari APP_URL / NEXTAUTH_URL; localhost hanya fallback development.
 * Jangan hardcode domain production.
 */
function getServerActionAllowedOrigins() {
  const origins = new Set(["localhost:3000", "127.0.0.1:3000"]);
  for (const key of ["APP_URL", "NEXTAUTH_URL"]) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      origins.add(new URL(raw).host);
    } catch {
      // abaikan nilai URL tidak valid
    }
  }
  return [...origins];
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  /**
   * CSP dasar: self + data/blob untuk foto bukti (data-URL) dan next/font (self-hosted).
   * style/script unsafe-inline diperlukan Next.js App Router + TipTap inline styles.
   * Tidak mengizinkan img/font eksternal — app tidak memakai CDN gambar/font.
   */
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: getServerActionAllowedOrigins(),
    },
    optimizePackageImports: ["next-auth/react", "next-themes"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
