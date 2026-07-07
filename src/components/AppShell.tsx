"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getAccessPassword, isAdminMode } from "@/lib/auth";
import { hydrateLocalStateFromCloud, syncLocalStateToCloud } from "@/lib/store";
import type { MarketFilter } from "@/types/trading";

const navItems = [
  { href: "/", label: "대시보드" },
  { href: "/trades", label: "매매일지" },
  { href: "/accounts", label: "계좌기록" },
  { href: "/converter", label: "지수/선물 변환기" },
  { href: "/stats", label: "통계/복기" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [market, setMarket] = useState<MarketFilter>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const admin = isAdminMode();

  async function refreshCloudData() {
    const password = getAccessPassword();
    if (!password) return;
    setSyncing(true);
    setSyncMessage("");
    await hydrateLocalStateFromCloud(password).catch(() => undefined);
    setSyncing(false);
    window.location.reload();
  }

  async function uploadLocalData() {
    setSyncing(true);
    setSyncMessage("");
    const ok = await syncLocalStateToCloud().catch(() => false);
    setSyncing(false);
    setSyncMessage(ok ? "클라우드 저장 완료" : "저장 실패: Supabase 환경변수나 secret key를 확인하세요.");
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <div className="text-lg font-black text-ink">Trading Journal</div>
          <div className="mt-1 text-xs text-slate-500">KOSPI 현물 + KOSPI200 선물</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:flex-1 lg:space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${
                  active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-200 p-4 lg:block">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-bold text-slate-500">기준 계좌</div>
            <div className="mt-1 text-sm font-black text-slate-900">선물/현물 통합 계좌</div>
            <div className="mt-3 text-xs text-slate-500">최근 동기화</div>
            <div className="mt-1 text-xs font-semibold text-slate-700">2026-07-03 15:30</div>
            <button className="btn btn-secondary mt-3 w-full" type="button" onClick={refreshCloudData} disabled={syncing}>데이터 새로고침</button>
            {admin && <button className="btn btn-primary mt-2 w-full" type="button" onClick={uploadLocalData} disabled={syncing}>현재 데이터 클라우드 저장</button>}
            {syncMessage && <div className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">{syncMessage}</div>}
          </div>
        </div>
      </aside>
      <main className="min-h-screen flex-1 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex rounded-lg border border-slate-300 bg-white p-1">
              {[
                ["all", "전체"],
                ["spot", "현물"],
                ["futures", "선물"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`rounded-md px-3 py-1.5 text-sm font-bold ${
                    market === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setMarket(value as MarketFilter)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex gap-2">
                <input className="input max-w-40" type="date" defaultValue="2026-06-28" />
                <input className="input max-w-40" type="date" defaultValue="2026-07-03" />
              </div>
              <div className="text-xs font-semibold text-slate-500">마지막 업데이트 15:30</div>
              <button className="btn btn-secondary" type="button" onClick={refreshCloudData} disabled={syncing}>새로고침</button>
              {syncMessage && <span className="text-xs font-bold text-slate-500">{syncMessage}</span>}
              {admin && <Link className="btn btn-primary" href="/trades/new">+ 거래 추가</Link>}
            </div>
          </div>
        </header>
        <div className="px-4 py-6 md:px-8">
          {children}
          <footer className="mt-10 rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500">
            투자 참고용이며 투자 책임은 본인에게 있습니다.
          </footer>
        </div>
      </main>
    </div>
  );
}
