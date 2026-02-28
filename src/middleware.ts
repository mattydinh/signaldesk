import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "signaldesk-dashboard";

export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const cookie = request.cookies.get(COOKIE_NAME)?.value;
    if (cookie !== password) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
