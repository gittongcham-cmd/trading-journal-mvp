import { NextResponse } from "next/server";

const VIEW_PASSWORD = process.env.VIEW_PASSWORD || "7531";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin7531";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  const normalizedPassword = password?.trim();

  if (!normalizedPassword) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (normalizedPassword === ADMIN_PASSWORD) {
    return NextResponse.json({ role: "admin" });
  }

  if (normalizedPassword === VIEW_PASSWORD) {
    return NextResponse.json({ role: "viewer" });
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
