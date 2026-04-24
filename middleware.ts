import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/** Public admin auth page — must not require a session (otherwise guests can never open it). */
function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admin routes: only TEACHER or SUPER_ADMIN (skip /admin/login)
    const needsStaffRole =
      (!isAdminLoginPath(pathname) && pathname.startsWith("/admin")) ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/records") ||
      pathname.startsWith("/violations") ||
      pathname.startsWith("/users");
    if (needsStaffRole) {
      if (!token || (token.role !== "TEACHER" && token.role !== "SUPER_ADMIN")) {
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
        if (pathname.startsWith("/form") || pathname.startsWith("/admin") || pathname.startsWith("/dashboard") || pathname.startsWith("/records") || pathname.startsWith("/violations") || pathname.startsWith("/users")) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/form/:path*", "/admin/:path*", "/dashboard/:path*", "/records/:path*", "/violations/:path*", "/users/:path*"],
};
