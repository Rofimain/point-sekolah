import type { NextRequest } from "next/server";

function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  try {
    if (first.includes("://")) return new URL(first).host.toLowerCase();
    // Host header / bare host[:port]
    return first.toLowerCase();
  } catch {
    return null;
  }
}

function hostFromUrlHeader(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts that are allowed to call sensitive same-origin account APIs. */
export function allowedRequestHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null) => {
    if (value) hosts.add(value);
  };

  add(normalizeHost(request.headers.get("x-forwarded-host")));
  add(normalizeHost(request.headers.get("host")));
  add(normalizeHost(request.nextUrl.host));
  add(hostFromUrlHeader(process.env.NEXTAUTH_URL));

  return hosts;
}

/**
 * CSRF guard for cookie-authenticated mutating routes.
 * Accepts Origin (preferred) or Referer, matched against public Host /
 * X-Forwarded-Host / NEXTAUTH_URL — not only request.nextUrl.host, which can
 * be the internal Docker hostname behind Caddy.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const allowed = allowedRequestHosts(request);
  if (allowed.size === 0) return false;

  const originHost = hostFromUrlHeader(request.headers.get("origin"));
  if (originHost && allowed.has(originHost)) return true;

  const refererHost = hostFromUrlHeader(request.headers.get("referer"));
  if (refererHost && allowed.has(refererHost)) return true;

  // Some browsers omit Origin on same-origin PATCH; Sec-Fetch-Site is set by the UA.
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" && (originHost === null || allowed.has(originHost))) {
    return Boolean(normalizeHost(request.headers.get("host")) || normalizeHost(request.headers.get("x-forwarded-host")));
  }

  return false;
}
