import {deliveryResponse} from '@/lib/seo-delivery/edge';
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "lighting_admin_session";

async function seoOriginalMiddleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const internalOrigin = process.env.INTERNAL_API_ORIGIN;
      if (!internalOrigin) throw new Error("INTERNAL_API_ORIGIN is required");
      const apiBase = `${internalOrigin.replace(/\/$/, "")}/api`;
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
  matcher: ["/admin/:path*","/products/:path*","/legacy-products/:path*"],
};
export async function middleware(request:Parameters<typeof seoOriginalMiddleware>[0]){if(request.nextUrl.pathname==='/admin'||request.nextUrl.pathname.startsWith('/admin/'))return seoOriginalMiddleware(request);return deliveryResponse(request);}
