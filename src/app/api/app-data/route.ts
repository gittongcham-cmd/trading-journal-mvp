import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const DATA_KEYS = ["trades", "accountBalanceSnapshots", "instrumentPrices", "customInstruments", "tradingRules", "dailyRuleChecks"];
const VIEW_PASSWORD = process.env.VIEW_PASSWORD || "7531";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin7531";

function isViewerPassword(password: string | null): boolean {
  return Boolean(password && (password.trim() === VIEW_PASSWORD || password.trim() === ADMIN_PASSWORD));
}

function isAdminPassword(password: string | null): boolean {
  return Boolean(password && password.trim() === ADMIN_PASSWORD);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  const password = request.headers.get("x-app-password");
  if (!isViewerPassword(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ trades: [], accountBalanceSnapshots: [], instrumentPrices: {} });
  }

  const { data, error } = await supabase.from("app_data").select("key,value").in("key", DATA_KEYS);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const state = {
    trades: [],
    accountBalanceSnapshots: [],
    instrumentPrices: {},
    customInstruments: [],
    tradingRules: [],
    dailyRuleChecks: []
  } as Record<string, unknown>;

  data?.forEach((row: { key: string; value: unknown }) => {
    state[row.key] = row.value;
  });

  return NextResponse.json(state);
}

export async function PUT(request: Request) {
  const password = request.headers.get("x-app-password");
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: "Admin password required" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase secret key is not configured" }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const rows = DATA_KEYS.map((key) => ({
    key,
    value: body[key] ?? (key === "instrumentPrices" ? {} : []),
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase.from("app_data").upsert(rows, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
