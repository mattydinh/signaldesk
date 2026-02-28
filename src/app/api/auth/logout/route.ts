import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/logout — clear dashboard auth cookie, redirect to home
 */
export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set("signaldesk-dashboard", "", { maxAge: 0, path: "/" });
  return res;
}
