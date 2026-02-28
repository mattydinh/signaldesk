import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "signaldesk-dashboard";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * POST /api/auth/login — set dashboard auth cookie if password matches
 * Body: { password: string }
 * Requires DASHBOARD_PASSWORD in env. If not set, login is not required.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json();
  const password = (body as { password?: string }).password ?? "";
  const next = (body as { next?: string }).next ?? "/dashboard";

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
