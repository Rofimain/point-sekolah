import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isStaffRole } from "@/lib/staff-roles";

function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

function isLegacyStaffRole(role: unknown) {
  return role === "PIKET" || role === "WALI_KELAS";
}

export const proxy = withAuth(
  function proxy(request) {
    const token = request.nextauth.token;
    const pathname = request.nextUrl.pathname;

    if (isLegacyStaffRole(token?.role)) {
      const signOut = new URL("/api/auth/signout", request.nextUrl.origin);
      signOut.searchParams.set("callbackUrl", `${request.nextUrl.origin}/admin/login`);
      return NextResponse.redirect(signOut);
    }

    if (token?.error === "AccountInactive" || token?.error === "SessionRevoked") {
      const loginPath = pathname.startsWith("/form") ? "/login" : "/admin/login";
      const signOut = new URL("/api/auth/signout", request.nextUrl.origin);
      signOut.searchParams.set("callbackUrl", `${request.nextUrl.origin}${loginPath}`);
      return NextResponse.redirect(signOut);
    }

    const needsStaffRole =
      (!isAdminLoginPath(pathname) && pathname.startsWith("/admin")) ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/records") ||
      pathname.startsWith("/students") ||
      pathname.startsWith("/violations") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/export") ||
      pathname.startsWith("/notifications") ||
      pathname.startsWith("/cetak-surat") ||
      pathname.startsWith("/classes");

    if (needsStaffRole && (!token || !isStaffRole(token.role as string))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    if (pathname.startsWith("/form") && (!token || token.role !== "STUDENT")) {
      return NextResponse.redirect(new URL("/login", request.url));
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
          pathname.startsWith("/export") ||
          pathname.startsWith("/notifications") ||
          pathname.startsWith("/cetak-surat") ||
          pathname.startsWith("/classes")
        ) {
          return Boolean(token);
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
    "/notifications/:path*",
    "/cetak-surat/:path*",
    "/classes/:path*",
  ],
};
