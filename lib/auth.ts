import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStaffRole } from "@/lib/staff-roles";
import { recordAuthLoginEvent } from "@/lib/auth-audit";
import {
  AUTH_ACCOUNT_UNAVAILABLE_ERROR,
  AUTH_GENERIC_CREDENTIALS_ERROR,
  AUTH_LOCKED_ERROR,
} from "@/lib/auth-constants";
import {
  isAccountLocked,
  isIpLoginRateLimited,
  registerFailedLogin,
  registerSuccessfulLogin,
} from "@/lib/auth-login-guard";
import { getAuthRequestMeta } from "@/lib/auth-request-meta";
import { canUserLogin } from "@/lib/user-status";
import {
  googleErrorRedirect,
  inferGooglePortal,
  isGoogleAuthEnabled,
  resolveAndLinkGoogleUser,
} from "@/lib/google-auth";

function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

type AuthPortal = "student" | "staff";

async function authorizeCredentials(portal: AuthPortal, credentials: Record<"email" | "password", string> | undefined) {
  const meta = await getAuthRequestMeta();
  const provider = portal === "student" ? "student-login" : "admin-login";

  if (!credentials?.email || !credentials?.password) {
    await recordAuthLoginEvent({
      provider,
      success: false,
      reason: "MISSING_CREDENTIALS",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new Error(AUTH_GENERIC_CREDENTIALS_ERROR);
  }

  if (await isIpLoginRateLimited(meta.ip)) {
    await recordAuthLoginEvent({
      identifier: normalizeIdentifier(credentials.email),
      provider,
      success: false,
      reason: "IP_RATE_LIMITED",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new Error(AUTH_LOCKED_ERROR);
  }

  const identifier = normalizeIdentifier(credentials.email);

  const user = identifier.includes("@")
    ? await prisma.user.findUnique({
        where: { email: identifier },
        include: { class: true },
      })
    : await prisma.user.findFirst({
        where: portal === "student" ? { nisn: identifier } : { nip: identifier },
        include: { class: true },
      });

  const roleOk = user ? (portal === "student" ? user.role === "STUDENT" : isStaffRole(user.role)) : false;

  if (!user || !roleOk) {
    await recordAuthLoginEvent({
      userId: user?.id,
      identifier,
      provider,
      success: false,
      reason: user ? "WRONG_PORTAL_OR_ROLE" : "NOT_FOUND",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new Error(AUTH_GENERIC_CREDENTIALS_ERROR);
  }

  if (!canUserLogin(user.status, user.deletedAt)) {
    await recordAuthLoginEvent({
      userId: user.id,
      identifier,
      provider,
      success: false,
      reason: user.deletedAt ? "DELETED" : `STATUS_${user.status}`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new Error(AUTH_ACCOUNT_UNAVAILABLE_ERROR);
  }

  if (isAccountLocked(user.lockedUntil)) {
    await recordAuthLoginEvent({
      userId: user.id,
      identifier,
      provider,
      success: false,
      reason: "LOCKED",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new Error(AUTH_LOCKED_ERROR);
  }

  const isValid = await bcrypt.compare(credentials.password, user.password);
  if (!isValid) {
    const { locked } = await registerFailedLogin(user.id);
    await recordAuthLoginEvent({
      userId: user.id,
      identifier,
      provider,
      success: false,
      reason: locked ? "INVALID_PASSWORD_LOCKED" : "INVALID_PASSWORD",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new Error(locked ? AUTH_LOCKED_ERROR : AUTH_GENERIC_CREDENTIALS_ERROR);
  }

  const { authVersion } = await registerSuccessfulLogin(user.id, { role: user.role });
  await recordAuthLoginEvent({
    userId: user.id,
    identifier,
    provider,
    success: true,
    reason: "OK",
    ip: meta.ip,
    userAgent: meta.userAgent,
    actorName: user.name,
    actorRole: user.role,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    nisn: user.nisn ?? undefined,
    nip: user.nip ?? undefined,
    className: user.class?.name ?? undefined,
    classId: user.classId ?? undefined,
    authVersion,
  };
}

function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      id: "student-login",
      name: "Student Login",
      credentials: {
        email: { label: "NISN / Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeCredentials("student", credentials);
      },
    }),
    CredentialsProvider({
      id: "admin-login",
      name: "Admin Login",
      credentials: {
        email: { label: "Email / NIP", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeCredentials("staff", credentials);
      },
    }),
  ];

  if (isGoogleAuthEnabled()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: false,
      })
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const jar = await cookies();
      const callbackUrl =
        jar.get("next-auth.callback-url")?.value || jar.get("__Secure-next-auth.callback-url")?.value || null;
      const portal = inferGooglePortal(callbackUrl ? decodeURIComponent(callbackUrl) : null);

      const googleSub = account.providerAccountId;
      const email = user.email ?? (profile as { email?: string } | undefined)?.email;
      const emailVerified =
        (profile as { email_verified?: boolean } | undefined)?.email_verified ??
        (user as { emailVerified?: boolean }).emailVerified;

      const resolved = await resolveAndLinkGoogleUser({
        googleSub,
        email,
        emailVerified,
      });

      if (!resolved.ok) {
        const meta = await getAuthRequestMeta();
        await recordAuthLoginEvent({
          identifier: email ?? undefined,
          provider: "google",
          success: false,
          reason: resolved.code,
          ip: meta.ip,
          userAgent: meta.userAgent,
          googlePortal: portal,
        });
        return googleErrorRedirect(resolved.code, portal);
      }

      // Pastikan objek user NextAuth memakai id internal DB (bukan Google sub).
      user.id = resolved.user.id;
      user.name = resolved.user.name;
      user.email = resolved.user.email;
      (user as { role?: string }).role = resolved.user.role;
      (user as { nisn?: string }).nisn = resolved.user.nisn ?? undefined;
      (user as { nip?: string }).nip = resolved.user.nip ?? undefined;
      (user as { className?: string }).className = resolved.user.class?.name ?? undefined;
      (user as { classId?: string }).classId = resolved.user.classId ?? undefined;
      (user as { authVersion?: number }).authVersion = resolved.user.authVersion;

      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const googleSub = account.providerAccountId;
        const dbUser = googleSub
          ? await prisma.user.findUnique({
              where: { googleSub },
              include: { class: true },
            })
          : user?.id
            ? await prisma.user.findUnique({
                where: { id: user.id },
                include: { class: true },
              })
            : null;

        if (!dbUser || !canUserLogin(dbUser.status) || dbUser.deletedAt) {
          token.error = "AccountInactive";
          return token;
        }

        token.id = dbUser.id;
        token.role = dbUser.role;
        token.nisn = dbUser.nisn ?? undefined;
        token.nip = dbUser.nip ?? undefined;
        token.className = dbUser.class?.name ?? undefined;
        token.classId = dbUser.classId ?? undefined;
        token.authVersion = dbUser.authVersion;
        token.email = dbUser.email;
        delete token.error;
        return token;
      }

      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role as string;
        token.nisn = (user as { nisn?: string }).nisn;
        token.nip = (user as { nip?: string }).nip;
        token.className = (user as { className?: string }).className;
        token.classId = (user as { classId?: string }).classId;
        token.authVersion = (user as { authVersion?: number }).authVersion;
        delete token.error;
      }

      /** Sinkronkan role dan status agar perubahan hak akses langsung berlaku pada sesi lama. */
      const userId = (token.id as string | undefined) || (token.sub as string | undefined);
      if (userId && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            status: true,
            active: true,
            role: true,
            nisn: true,
            nip: true,
            classId: true,
            authVersion: true,
            lockedUntil: true,
            deletedAt: true,
            class: { select: { name: true } },
          },
        });
        if (!dbUser || !canUserLogin(dbUser.status, dbUser.deletedAt)) {
          token.error = "AccountInactive";
        } else if (isAccountLocked(dbUser.lockedUntil)) {
          token.error = "AccountInactive";
        } else if (token.authVersion !== dbUser.authVersion) {
          token.error = "SessionRevoked";
        } else {
          token.role = dbUser.role;
          token.nisn = dbUser.nisn ?? undefined;
          token.nip = dbUser.nip ?? undefined;
          token.classId = dbUser.classId ?? undefined;
          token.className = dbUser.class?.name ?? undefined;
          delete token.error;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.error === "AccountInactive" || token?.error === "SessionRevoked") {
        return {
          ...session,
          error: token.error,
          user: { ...session.user, id: "", email: null, role: "INACTIVE" },
        } as Session;
      }
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.nisn = token.nisn as string;
        session.user.nip = token.nip as string;
        session.user.className = token.className as string;
        session.user.classId = token.classId as string;
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        /* ignore */
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hours
  secret: process.env.NEXTAUTH_SECRET,
};

/** Returns null instead of throwing when the session cookie is invalid (e.g. after NEXTAUTH_SECRET change). */
export async function getSafeServerSession(): Promise<Session | null> {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

// Extend types
declare module "next-auth" {
  interface User {
    role?: string;
    nisn?: string;
    nip?: string;
    className?: string;
    classId?: string;
    authVersion?: number;
  }
  interface Session {
    error?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      nisn?: string;
      nip?: string;
      className?: string;
      classId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    nisn?: string;
    nip?: string;
    className?: string;
    classId?: string;
    authVersion?: number;
    error?: string;
    email?: string | null;
  }
}
