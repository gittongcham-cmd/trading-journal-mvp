"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sumNegative, sumPositive } from "@/lib/accountBalances";
import { isAdminMode } from "@/lib/auth";
import { calculateWinRate, getClosedTrades } from "@/lib/calculations";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { calculateOpenPositions, summarizeOpenPositions } from "@/lib/holdings";
import { loadAccountBalanceSnapshots, loadInstrumentPrices, loadTrades } from "@/lib/store";
import type { AccountBalanceSnapshot, PositionHoldingSummary, Trade } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

export function DashboardPage() {
  const admin = isAdminMode();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<AccountBalanceSnapshot[]>([]);

  useEffect(() => {
    setTrades(loadTrades());
    setAccounts(loadAccountBalanceSnapshots());
  }, []);

  const prices = loadInstrumentPrices();
  const latest = accounts[accounts.length - 1];
  const latestPositive = latest ? sumPositive(latest.items) : 0;
  const latestNegative = latest ? sumNegative(latest.items) : 0;
  const positions = useMemo(() => calculateOpenPositions(trades, prices), [trades, prices]);
  const positionSummary = useMemo(() => summarizeOpenPositions(positions), [positions]);
  const today = new Date().toISOString().slice(0, 10);
  const closedTrades = getClosedTrades(trades);
  const todayRealizedPnl = closedTrades.filter((trade) => trade.tradeDate === today).reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const totalRealizedPnl = sumPnl(closedTrades);
  const spotRealizedPnl = sumPnl(closedTrades.filter((trade) => trade.marketType === "spot"));
  const futuresRealizedPnl = sumPnl(closedTrades.filter((trade) => trade.marketType === "futures"));
  const weeklyAccounts = useMemo(() => toWeeklyBalance(accounts), [accounts]);
  const marketAmountShare = [
    { name: "현물", value: Math.abs(positionSummary.spotCurrentAmount), raw: positionSummary.spotCurrentAmount },
    { name: "선물", value: Math.abs(positionSummary.futuresCurrentAmount), raw: positionSummary.futuresCurrentAmount }
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">수기 계좌 잔고와 매매 성과를 나눠서 봅니다. 실현손익과 미실현손익은 섞지 않습니다.</p>
        </div>
        {admin && <Link className="btn btn-primary" href="/trades/new">+ 거래 추가</Link>}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">내 자산</h2>
            <p className="text-sm text-slate-500">계좌 잔고 등록 화면에서 수기로 입력한 값만 사용합니다.</p>
          </div>
          {admin && <Link className="btn btn-secondary" href="/account-records/new">+ 계좌 잔고 등록</Link>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="최신 총 잔고" value={formatKRW(latest?.totalBalance ?? 0)} tone="pnl" caption="수기 계좌 잔고 기준" />
          <KpiCard label="플러스 잔고 합계" value={formatKRW(latestPositive)} caption="양수 계좌 합계" />
          <KpiCard label="마이너스 잔고 합계" value={formatKRW(latestNegative)} tone="pnl" caption="대출, 미수 등 음수 잔고" />
          <KpiCard label="계좌 개수" value={`${latest?.items.length ?? 0}개`} caption="최근 기록에 포함된 계좌" />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-black text-slate-950">오늘의 매매 성과</h2>
        <p className="mb-3 text-sm text-slate-500">누적수익은 청산 완료 거래의 실현손익만, 보유 포지션은 현재가 기준 미실현손익으로 따로 봅니다.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <KpiCard label="오늘 실현손익" value={formatKRW(todayRealizedPnl)} tone="pnl" caption="오늘 청산된 거래 기준" />
          <KpiCard label="전체 누적수익" value={formatKRW(totalRealizedPnl)} tone="pnl" caption="실현손익 기준" />
          <KpiCard label="현물 누적수익" value={formatKRW(spotRealizedPnl)} tone="pnl" caption="현물 청산 거래" />
          <KpiCard label="선물 누적수익" value={formatKRW(futuresRealizedPnl)} tone="pnl" caption="선물 청산 거래" />
          <KpiCard label="미실현손익" value={formatKRW(positionSummary.unrealizedPnl)} tone="pnl" caption={positionSummary.missingPriceCount ? `${positionSummary.missingPriceCount}개 현재가 입력 필요` : "현재가 입력분 기준"} />
          <KpiCard label="평가수익률" value={formatPercent(positionSummary.valuationReturnRate)} tone="pnl" caption="보유 포지션 기준" />
          <KpiCard label="승률" value={formatPercent(calculateWinRate(closedTrades))} caption="청산 거래 기준" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="계좌금액 추이" description="주별 마지막 계좌 잔고를 사용합니다.">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyAccounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}백만`} />
              <Tooltip formatter={(value) => formatKRW(Number(value))} />
              <Area dataKey="totalBalance" stroke="#2563eb" fill="#dbeafe" name="총 잔고" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="현물 / 선물 총액 비중" description="보유 포지션 기준입니다. 선물은 현재가가 없으면 진입가 기준 명목금액으로 계산합니다.">
          {marketAmountShare.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={marketAmountShare} dataKey="value" nameKey="name" innerRadius={60} outerRadius={94} label={(item) => `${item.name} ${formatKRW(item.raw)}`}>
                  <Cell fill="#14b8a6" />
                  <Cell fill="#2563eb" />
                </Pie>
                <Tooltip formatter={(_value, _name, item) => formatKRW(Number(item.payload.raw))} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState text="현재가를 입력하면 현물/선물 총액 비중을 볼 수 있어요." />}
        </ChartCard>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">현재 보유 중인 포지션</h2>
          <p className="mt-1 text-sm text-slate-500">QuoteProvider의 수동 현재가를 기준으로 현물과 선물 미실현손익을 계산합니다.</p>
        </div>
        <PositionTable positions={positions} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5 text-lg font-black">최근 체결 기록</div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["일시", "시장", "종목", "구분", "매수/매도", "진입가", "청산가", "수량/계약수", "실현손익"].map((head, index) => <th key={head} className={`px-4 py-3 ${index >= 5 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {trades.slice(-6).reverse().map((trade) => (
                <tr key={trade.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{trade.tradeDate}</td>
                  <td className="px-4 py-3"><MarketPill market={trade.marketType} /></td>
                  <td className="px-4 py-3 font-bold">{trade.instrumentName}</td>
                  <td className="px-4 py-3">{trade.tradeAction}</td>
                  <td className="px-4 py-3">{trade.positionSide === "long" ? "매수" : "매도"}</td>
                  <td className="px-4 py-3 text-right">{trade.entryPrice.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right">{trade.exitPrice?.toLocaleString("ko-KR") ?? "-"}</td>
                  <td className="px-4 py-3 text-right">{trade.marketType === "spot" ? `${trade.quantity ?? 0}주` : `${trade.contractCount ?? 0}계약`}</td>
                  <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.realizedPnl)}`}>{formatKRW(trade.realizedPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PositionTable({ positions }: { positions: PositionHoldingSummary[] }) {
  if (!positions.length) {
    return <EmptyState text="아직 보유 중인 포지션이 없습니다. 거래 추가에서 신규 진입을 남기면 이곳에 표시됩니다." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>{["시장", "종목", "보유수량/계약수", "평균진입가", "현재가", "투자금액/명목금액", "현재금액", "미실현손익", "수익률", "현재가 업데이트"].map((head, index) => <th key={head} className={`px-4 py-3 ${index >= 2 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id} className="border-t border-slate-100">
              <td className="px-4 py-3"><MarketPill market={position.marketType} /></td>
              <td className="px-4 py-3 font-bold">{position.instrumentName}</td>
              <td className="px-4 py-3 text-right">{position.marketType === "spot" ? `${position.quantity.toLocaleString("ko-KR")}주` : `${position.quantity.toLocaleString("ko-KR")}계약`}</td>
              <td className="px-4 py-3 text-right">{position.marketType === "spot" ? formatKRW(position.averageEntryPrice) : `${position.averageEntryPrice.toLocaleString("ko-KR")}pt`}</td>
              <td className="px-4 py-3 text-right">{position.currentPrice === undefined ? <MissingPrice /> : position.marketType === "spot" ? formatKRW(position.currentPrice) : `${position.currentPrice.toLocaleString("ko-KR")}pt`}</td>
              <td className="px-4 py-3 text-right">{formatKRW(position.investmentAmount)}</td>
              <td className="px-4 py-3 text-right">{position.currentAmount === undefined ? "-" : formatKRW(position.currentAmount)}</td>
              <td className={`px-4 py-3 text-right font-black ${position.unrealizedPnl === undefined ? "text-slate-400" : pnlClass(position.unrealizedPnl)}`}>{position.unrealizedPnl === undefined ? "-" : formatKRW(position.unrealizedPnl)}</td>
              <td className={`px-4 py-3 text-right font-black ${position.returnRate === undefined ? "text-slate-400" : pnlClass(position.returnRate)}`}>{position.returnRate === undefined ? "-" : formatPercent(position.returnRate)}</td>
              <td className="px-4 py-3 text-right text-slate-500">{position.updatedAt ? new Date(position.updatedAt).toLocaleString("ko-KR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sumPnl(trades: Trade[]): number {
  return trades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
}

function toWeeklyBalance(records: AccountBalanceSnapshot[]) {
  const byWeek = new Map<string, { label: string; totalBalance: number; recordDate: string }>();
  records.forEach((record) => {
    const date = new Date(record.recordDate);
    const month = date.getMonth() + 1;
    const week = Math.ceil(date.getDate() / 7);
    const key = `${date.getFullYear()}-${month}-${week}`;
    const label = `${month}월 ${week}주`;
    const current = byWeek.get(key);
    if (!current || record.recordDate >= current.recordDate) byWeek.set(key, { label, totalBalance: record.totalBalance, recordDate: record.recordDate });
  });
  return Array.from(byWeek.values());
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="card p-5"><h2 className="text-lg font-black">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}<div className="mt-4">{children}</div></section>;
}

function MarketPill({ market }: { market: "spot" | "futures" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${market === "spot" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}>{market === "spot" ? "현물" : "선물"}</span>;
}

function MissingPrice() {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">현재가 입력 필요</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-6 text-center text-sm font-semibold text-slate-500">{text}</div>;
}
