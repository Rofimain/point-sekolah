import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStaffRole } from "@/lib/staff-roles";

function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "student-login",
      name: "Student Login",
      credentials: {
        email: { label: "NISN / Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = normalizeIdentifier(credentials.email);

        const user = identifier.includes("@")
          ? await prisma.user.findUnique({
              where: { email: identifier },
              include: { class: true },
            })
          : await prisma.user.findFirst({
              where: { nisn: identifier },
              include: { class: true },
            });

        if (!user || user.role !== "STUDENT") {
          throw new Error("Akun siswa tidak ditemukan");
        }
        if (!user.active) {
          throw new Error("Akun Anda telah dinonaktifkan. Hubungi guru / TU.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) throw new Error("Password salah");

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          nisn: user.nisn ?? undefined,
          className: user.class?.name ?? undefined,
          classId: user.classId ?? undefined,
          authVersion: user.authVersion,
        };
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
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = normalizeIdentifier(credentials.email);

        const user = identifier.includes("@")
          ? await prisma.user.findUnique({
              where: { email: identifier },
              include: { class: true },
            })
          : await prisma.user.findFirst({
              where: { nip: identifier },
              include: { class: true },
            });

        if (!user || !isStaffRole(user.role)) {
          throw new Error("Akun admin/guru tidak ditemukan");
        }
        if (!user.active) {
          throw new Error("Akun Anda telah dinonaktifkan.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) throw new Error("Password salah");

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          nip: user.nip ?? undefined,
          className: user.class?.name ?? undefined,
          classId: user.classId ?? undefined,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.nisn = (user as any).nisn;
        token.nip = (user as any).nip;
        token.className = (user as any).className;
        token.classId = (user as any).classId;
        token.authVersion = (user as any).authVersion;
        delete token.error;
      }

      /** Sinkronkan role dan status agar perubahan hak akses langsung berlaku pada sesi lama. */
      const userId = (token.id as string | undefined) || (token.sub as string | undefined);
      if (userId && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            active: true,
            role: true,
            nisn: true,
            nip: true,
            classId: true,
            authVersion: true,
            class: { select: { name: true } },
          },
        });
        if (!dbUser?.active) {
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
        // Jangan teruskan identitas bila nonaktif (API tanpa middleware masih memakai getServerSession).
        return { ...session, user: { ...session.user, id: "", email: null, role: "INACTIVE" } } as Session;
      }
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.nisn = token.nisn as string;
        session.user.nip = token.nip as string;
        session.user.className = token.className as string;
        session.user.classId = token.classId as string;
      }
      return session;
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
  }
}
