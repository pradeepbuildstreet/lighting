import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "lighting_admin_session";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
      const response = await fetch(`${apiBase}/auth/me`, {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
        cache: "no-store",
      });
      if (response.ok) return NextResponse.next();
    } catch {
      // Failed verification returns the user to sign-in.
    }
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};