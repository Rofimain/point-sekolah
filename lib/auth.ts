import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";
const STAFF_DOMAIN = process.env.NEXT_PUBLIC_STAFF_DOMAIN || "sman1contoh.sch.id";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "student-login",
      name: "Student Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const domain = email.split("@")[1];

        if (domain !== STUDENT_DOMAIN) {
          throw new Error("Email harus menggunakan domain siswa sekolah (@" + STUDENT_DOMAIN + ")");
        }

        const user = await prisma.user.findUnique({
          where: { email },
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
        };
      },
    }),
    CredentialsProvider({
      id: "admin-login",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const domain = email.split("@")[1];

        if (domain !== STAFF_DOMAIN) {
          throw new Error("Email harus menggunakan domain staff sekolah (@" + STAFF_DOMAIN + ")");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { class: true },
        });

        if (!user || user.role === "STUDENT") {
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
      }
      return token;
    },
    async session({ session, token }) {
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

// Extend types
declare module "next-auth" {
  interface User {
    role?: string;
    nisn?: string;
    nip?: string;
    className?: string;
    classId?: string;
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
  }
}
