import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH_SECRET = process.env.AUTH_SECRET;
const COOKIE_NAME = "auth-token";

export async function POST(request: Request) {
  if (!AUTH_SECRET) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const { password } = await request.json();
  if (password !== AUTH_SECRET) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, AUTH_SECRET, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}
