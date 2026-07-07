"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sumNegative, sumPositive } from "@/lib/accountBalances";
import { isAdminMode } from "@/lib/auth";
import { calculateWinRate } from "@/lib/calculations";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { loadAccountBalanceSnapshots, loadTrades } from "@/lib/store";
import type { AccountBalanceSnapshot, Trade } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

export function DashboardPage() {
  const admin = isAdminMode();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<AccountBalanceSnapshot[]>([]);
  const [range, setRange] = useState("30일");

  useEffect(() => {
    setTrades(loadTrades());
    setAccounts(loadAccountBalanceSnapshots());
  }, []);

  const latest = accounts[accounts.length - 1];
  const latestPositive = latest ? sumPositive(latest.items) : 0;
  const latestNegative = latest ? sumNegative(latest.items) : 0;
  const today = "2026-07-03";
  const todayTrades = trades.filter((trade) => trade.tradeDate === today);
  const totalPnl = sumPnl(trades);
  const spotPnl = sumPnl(trades.filter((trade) => trade.marketType === "spot"));
  const futuresPnl = sumPnl(trades.filter((trade) => trade.marketType === "futures"));
  const todayTotalPnl = sumPnl(todayTrades, true);
  const todaySpotPnl = sumPnl(todayTrades.filter((trade) => trade.marketType === "spot"), true);
  const todayFuturesPnl = sumPnl(todayTrades.filter((trade) => trade.marketType === "futures"), true);
  const initialAsset = accounts[0]?.totalBalance ?? 1;
  const cumulativeReturn = latest ? ((latest.totalBalance - initialAsset) / initialAsset) * 100 : 0;
  const positions = trades.filter((trade) => trade.tradeAction === "entry");

  const dailyPnl = useMemo(() => {
    const byDate = new Map<string, number>();
    trades.forEach((trade) => byDate.set(trade.tradeDate, (byDate.get(trade.tradeDate) ?? 0) + trade.realizedPnl + trade.unrealizedPnl));
    return Array.from(byDate.entries()).map(([date, pnl]) => ({ date, pnl }));
  }, [trades]);

  const marketShare = [
    { name: "현물 손익", value: Math.abs(spotPnl), raw: spotPnl },
    { name: "선물 손익", value: Math.abs(futuresPnl), raw: futuresPnl },
    { name: "전체 손익", value: Math.abs(totalPnl), raw: totalPnl }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">수기 등록한 계좌 잔고와 매매일지 성과를 분리해서 봅니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-40" type="date" defaultValue="2026-06-28" />
          <input className="input max-w-40" type="date" defaultValue="2026-07-03" />
          <span className="text-xs font-semibold text-slate-500">마지막 업데이트 15:30</span>
          {admin && <Link className="btn btn-primary" href="/trades/new">+ 거래 추가</Link>}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">내 자산</h2>
          {admin && <Link className="btn btn-secondary" href="/account-records/new">+ 계좌 잔고 등록</Link>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard label="최신 총 잔고" value={formatKRW(latest?.totalBalance ?? 0)} tone="pnl" icon="₩" />
          <KpiCard label="직전 기록 대비" value={formatChange(latest?.previousRecordChangeAmount, latest?.previousRecordChangeRate)} tone="pnl" icon="R" />
          <KpiCard label="전달 대비" value={formatChange(latest?.previousMonthChangeAmount, latest?.previousMonthChangeRate)} tone="pnl" icon="M" />
          <KpiCard label="플러스 잔고 합계" value={formatKRW(latestPositive)} icon="+" />
          <KpiCard label="마이너스 잔고 합계" value={formatKRW(latestNegative)} tone="pnl" icon="-" />
          <KpiCard label="계좌 개수" value={`${latest?.items.length ?? 0}개`} icon="A" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">매매 성과</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="오늘 전체 손익" value={formatKRW(todayTotalPnl)} tone="pnl" icon="D" />
        <KpiCard label="오늘 현물 손익" value={formatKRW(todaySpotPnl)} tone="pnl" icon="S" />
        <KpiCard label="오늘 선물 손익" value={formatKRW(todayFuturesPnl)} tone="pnl" icon="F" />
        <KpiCard label="전체 누적수익" value={formatKRW(totalPnl)} tone="pnl" icon="Σ" />
        <KpiCard label="현물 누적수익" value={formatKRW(spotPnl)} tone="pnl" icon="S" />
        <KpiCard label="선물 누적수익" value={formatKRW(futuresPnl)} tone="pnl" icon="F" />
        <KpiCard label="누적 수익률" value={formatPercent(cumulativeReturn)} icon="%" />
        <KpiCard label="승률" value={formatPercent(calculateWinRate(trades))} icon="W" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">현재 보유 포지션</h2>
            <span className="text-xs font-bold text-slate-400">현물/선물 통합</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {positions.map((position) => {
              const currentPrice = position.marketType === "spot" ? position.entryPrice - 300 : position.entryPrice + 0.25;
              const evaluation = position.marketType === "spot" ? currentPrice * (position.quantity ?? 0) : currentPrice * (position.multiplier ?? 250000) * (position.contractCount ?? 0);
              return (
                <div key={position.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-black">{position.instrumentName}</div>
                    <MarketPill market={position.marketType} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <Metric label="진입가" value={position.marketType === "spot" ? `${position.entryPrice.toLocaleString("ko-KR")}원` : `${position.entryPrice.toLocaleString("ko-KR")}pt`} />
                    <Metric label="현재가" value={position.marketType === "spot" ? `${currentPrice.toLocaleString("ko-KR")}원` : `${currentPrice.toLocaleString("ko-KR")}pt`} />
                    <Metric label="수량/계약수" value={position.marketType === "spot" ? `${position.quantity ?? 0}주` : `${position.contractCount ?? 0}계약`} />
                    <Metric label="평가금액" value={formatKRW(evaluation)} alignRight />
                    <Metric label="미실현손익" value={formatKRW(position.unrealizedPnl)} className={pnlClass(position.unrealizedPnl)} alignRight />
                    <Metric label="수익률" value={formatPercent(position.returnRate)} alignRight />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">지수/선물 현재가</h2>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">실시간 연동 전 더미</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Quote label="KOSPI" value="2,664.63pt" change="+0.42%" />
            <Quote label="KOSPI200" value="372.91pt" change="+0.38%" />
            <Quote label="KOSPI200 선물" value="373.20pt" change="+0.45%" />
            <Quote label="Basis" value="0.29pt" change="선물-현물" />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard title="계좌금액 추이" action={<RangeTabs value={range} onChange={setRange} />}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={accounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="recordDate" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}백만`} />
              <Tooltip formatter={(value) => formatKRW(Number(value))} />
              <Area dataKey="totalBalance" stroke="#2563eb" fill="#dbeafe" name="총 잔고" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="일별 손익">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyPnl}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} />
              <Tooltip formatter={(value) => formatKRW(Number(value))} />
              <Bar dataKey="pnl" name="손익">
                {dailyPnl.map((item) => <Cell key={item.date} fill={item.pnl >= 0 ? "#ef4444" : "#3b82f6"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="현물/선물 손익 비중">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={marketShare} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} label>
                <Cell fill="#14b8a6" />
                <Cell fill="#2563eb" />
                <Cell fill="#94a3b8" />
              </Pie>
              <Tooltip formatter={(value, _name, item) => formatKRW(Number(item.payload.raw))} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5 text-lg font-black">최근 체결 기록</div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["일시", "시장", "종목", "구분", "매수/매도", "진입가", "청산가", "수량/계약수", "손익", "수익률"].map((head, index) => <th key={head} className={`px-4 py-3 ${index >= 5 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {trades.slice(-6).reverse().map((trade) => (
                <tr key={trade.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{trade.tradeDate}</td>
                  <td className="px-4 py-3"><MarketPill market={trade.marketType} /></td>
                  <td className="px-4 py-3 font-bold">{trade.instrumentName}</td>
                  <td className="px-4 py-3">{trade.tradeAction}</td>
                  <td className="px-4 py-3"><SidePill side={trade.positionSide} /></td>
                  <td className="px-4 py-3 text-right">{trade.entryPrice.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right">{trade.exitPrice?.toLocaleString("ko-KR") ?? "-"}</td>
                  <td className="px-4 py-3 text-right">{trade.marketType === "spot" ? `${trade.quantity ?? 0}주` : `${trade.contractCount ?? 0}계약`}</td>
                  <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.realizedPnl)}`}>{formatKRW(trade.realizedPnl)}</td>
                  <td className="px-4 py-3 text-right">{formatPercent(trade.returnRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function sumPnl(trades: Trade[], includeUnrealized = false): number {
  return trades.reduce((sum, trade) => sum + trade.realizedPnl + (includeUnrealized ? trade.unrealizedPnl : 0), 0);
}

function formatChange(amount?: number, rate?: number): string {
  if (amount === undefined || rate === undefined) return "비교 데이터 없음";
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatKRW(amount)} / ${sign}${formatPercent(rate)}`;
}

function ChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="card p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2>{action}</div>{children}</section>;
}

function RangeTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex rounded-lg border border-slate-200 p-1">{["30일", "3개월", "6개월"].map((item) => <button key={item} className={`rounded-md px-2 py-1 text-xs font-bold ${value === item ? "bg-blue-600 text-white" : "text-slate-500"}`} onClick={() => onChange(item)} type="button">{item}</button>)}</div>;
}

function MarketPill({ market }: { market: "spot" | "futures" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${market === "spot" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}>{market === "spot" ? "현물" : "선물"}</span>;
}

function SidePill({ side }: { side: "long" | "short" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${side === "long" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{side === "long" ? "매수" : "매도"}</span>;
}

function Metric({ label, value, className = "", alignRight = false }: { label: string; value: string; className?: string; alignRight?: boolean }) {
  return <div className={alignRight ? "text-right" : ""}><div className="text-xs font-bold text-slate-400">{label}</div><div className={`mt-1 font-black text-slate-800 ${className}`}>{value}</div></div>;
}

function Quote({ label, value, change }: { label: string; value: string; change: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-bold text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-bold text-red-500">{change}</div></div>;
}
