import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admin routes: only TEACHER or SUPER_ADMIN
    if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard") || pathname.startsWith("/records") || pathname.startsWith("/violations") || pathname.startsWith("/users")) {
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
