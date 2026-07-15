import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isStaffRole } from "@/lib/staff-roles";

/** Public admin auth page — must not require a session (otherwise guests can never open it). */
function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

/** Cookie sebelum migrasi role harus login ulang agar claim memakai role kanonis. */
function isLegacyStaffRole(role: unknown) {
  return role === "PIKET" || role === "WALI_KELAS";
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (isLegacyStaffRole(token?.role)) {
      const signOut = new URL("/api/auth/signout", req.nextUrl.origin);
      signOut.searchParams.set("callbackUrl", `${req.nextUrl.origin}/admin/login`);
      return NextResponse.redirect(signOut);
    }

    /** Akun dinonaktifkan setelah JWT dibuat — paksa keluar & hapus cookie sesi. */
    if (token?.error === "AccountInactive") {
      const loginPath = pathname.startsWith("/form") ? "/login" : "/admin/login";
      const signOut = new URL("/api/auth/signout", req.nextUrl.origin);
      signOut.searchParams.set("callbackUrl", `${req.nextUrl.origin}${loginPath}`);
      return NextResponse.redirect(signOut);
    }

    // Area staf: guru, admin, dan super admin (skip /admin/login)
    const needsStaffRole =
      (!isAdminLoginPath(pathname) && pathname.startsWith("/admin")) ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/records") ||
      pathname.startsWith("/students") ||
      pathname.startsWith("/violations") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/export");
    if (needsStaffRole) {
      if (!token || !isStaffRole(token.role as string)) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    // Student form route: only STUDENT
    if (pathname.startsWith("/form")) {
      if (!token || token.role !== "STUDENT") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        if (isAdminLoginPath(pathname)) return true;
        if (
          pathname.startsWith("/form") ||
          pathname.startsWith("/admin") ||
          pathname.startsWith("/dashboard") ||
          pathname.startsWith("/records") ||
          pathname.startsWith("/students") ||
          pathname.startsWith("/violations") ||
          pathname.startsWith("/users") ||
          pathname.startsWith("/settings") ||
          pathname.startsWith("/export")
        ) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/form/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/records/:path*",
    "/students",
    "/students/:path*",
    "/violations/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/export/:path*",
  ],
};
