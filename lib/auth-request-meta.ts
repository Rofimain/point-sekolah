import { headers } from "next/headers";

export type AuthRequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

/** Baca IP/UA dari request Next.js (NextAuth authorize berjalan di konteks request yang sama). */
export async function getAuthRequestMeta(): Promise<AuthRequestMeta> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
    const userAgent = h.get("user-agent");
    return { ip, userAgent: userAgent ? userAgent.slice(0, 512) : null };
  } catch {
    return { ip: null, userAgent: null };
  }
}
