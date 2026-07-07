import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ role: "admin" });
  }

  if (password === process.env.VIEW_PASSWORD) {
    return NextResponse.json({ role: "viewer" });
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
