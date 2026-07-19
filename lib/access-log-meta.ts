import type { AccessLogPortal } from "@/generated/prisma/client";

/** Portal login dari provider NextAuth credentials / google. */
export function portalFromAuthProvider(provider: string, googlePortal?: "student" | "staff" | null): AccessLogPortal {
  if (provider === "student-login") return "STUDENT";
  if (provider === "admin-login") return "STAFF";
  if (provider === "google") {
    return googlePortal === "staff" ? "STAFF" : "STUDENT";
  }
  return "SYSTEM";
}

/** Portal staf vs siswa dari role actor. */
export function portalFromActorRole(role: string | null | undefined): AccessLogPortal {
  if (role === "STUDENT") return "STUDENT";
  if (role === "TEACHER" || role === "ADMIN" || role === "SUPER_ADMIN") return "STAFF";
  return "SYSTEM";
}

export type AccessLogActor = {
  id?: string | null;
  name?: string | null;
  role?: string | null;
};

export function accessLogActorFromSession(
  session: {
    user?: { id?: string | null; name?: string | null; role?: string | null } | null;
  } | null
): AccessLogActor | null {
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    role: session.user.role ?? null,
  };
}
