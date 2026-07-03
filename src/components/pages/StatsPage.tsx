"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKRW, formatNumber, formatPercent, pnlClass } from "@/lib/format";
import { loadAccountRecords, loadTrades } from "@/lib/store";
import type { AccountRecord, EmotionTag, Trade } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

const emotionLabels: Record<EmotionTag, string> = {
  confidence: "자신감",
  anxiety: "불안",
  impatience: "조급함",
  greed: "욕심",
  fear: "공포",
  calm: "평온",
  regret: "후회",
  conviction: "확신"
};

export function StatsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  useEffect(() => { setTrades(loadTrades()); setAccounts(loadAccountRecords()); }, []);

  const closed = trades.filter((trade) => trade.realizedPnl !== 0);
  const profits = closed.filter((trade) => trade.realizedPnl > 0);
  const losses = closed.filter((trade) => trade.realizedPnl < 0);
  const cumulativePnl = trades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const averageProfit = profits.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(profits.length, 1);
  const averageLoss = losses.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(losses.length, 1);
  const profitLossRatio = Math.abs(averageProfit / (averageLoss || -1));
  const spotPnl = trades.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const futuresPnl = trades.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const maxDrawdown = useMemo(() => {
    let peak = accounts[0]?.totalAsset ?? 0;
    let drawdown = 0;
    accounts.forEach((account) => {
      peak = Math.max(peak, account.totalAsset);
      drawdown = Math.min(drawdown, account.totalAsset - peak);
    });
    return drawdown;
  }, [accounts]);

  const monthly = useMemo(() => aggregate(trades, (trade) => trade.tradeDate.slice(0, 7)), [trades]);
  const weekday = useMemo(() => aggregate(trades, (trade) => ["일", "월", "화", "수", "목", "금", "토"][new Date(`${trade.tradeDate}T00:00:00`).getDay()]), [trades]);
  const byMarket = [
    { name: "현물", value: Math.abs(trades.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0)) },
    { name: "선물", value: Math.abs(trades.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0)) }
  ];
  const byInstrument = useMemo(() => aggregate(trades, (trade) => trade.instrumentName), [trades]);
  const emotionStats = (Object.keys(emotionLabels) as EmotionTag[]).map((tag) => {
    const tagged = trades.filter((trade) => trade.emotionTags.includes(tag));
    const wins = tagged.filter((trade) => trade.realizedPnl > 0).length;
    return {
      tag,
      label: emotionLabels[tag],
      ratio: trades.length ? (tagged.length / trades.length) * 100 : 0,
      averagePnl: tagged.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(tagged.length, 1),
      winRate: tagged.length ? (wins / tagged.length) * 100 : 0,
      correlation: tagged.reduce((sum, trade) => sum + trade.realizedPnl, 0) >= 0 ? "수익 쪽" : "손실 쪽"
    };
  });

  return (
    <div>
      <SectionHeader title="통계/복기" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="전체 누적수익" value={formatKRW(cumulativePnl)} tone="pnl" />
        <KpiCard label="현물 누적수익" value={formatKRW(spotPnl)} tone="pnl" />
        <KpiCard label="선물 누적수익" value={formatKRW(futuresPnl)} tone="pnl" />
        <KpiCard label="최대 낙폭" value={formatKRW(maxDrawdown)} tone="pnl" />
        <KpiCard label="평균 수익" value={formatKRW(averageProfit)} tone="pnl" />
        <KpiCard label="평균 손실" value={formatKRW(averageLoss)} tone="pnl" />
        <KpiCard label="손익비" value={formatNumber(profitLossRatio, 2)} />
        <KpiCard label="최고 승률 구간" value="오전" />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Chart title="월별 손익"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} /><Bar dataKey="pnl">{monthly.map((item) => <Cell key={item.name} fill={item.pnl >= 0 ? "#dc2626" : "#2563eb"} />)}</Bar></BarChart></Chart>
        <Chart title="요일별 성과"><BarChart data={weekday}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} /><Bar dataKey="pnl" fill="#475569" /></BarChart></Chart>
        <Chart title="누적 자산곡선"><AreaChart data={accounts}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="recordDate" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} /><Area dataKey="totalAsset" stroke="#0f172a" fill="#dbeafe" /></AreaChart></Chart>
        <Chart title="현물/선물별 손익 비중"><PieChart><Pie data={byMarket} dataKey="value" nameKey="name" outerRadius={90} label><Cell fill="#ef4444" /><Cell fill="#2563eb" /></Pie><Tooltip formatter={(value) => formatKRW(Number(value))} /></PieChart></Chart>
        <Chart title="상품/전략별 손익 비중"><BarChart data={byInstrument}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} /><Bar dataKey="pnl" fill="#0f766e" /></BarChart></Chart>
      </div>
      <div className="card mt-5 p-4">
        <div className="mb-3 text-lg font-black">감정 분석</div>
        <div className="grid gap-3 md:grid-cols-4">
          {emotionStats.map((emotion) => (
            <div key={emotion.tag} className="rounded-md border border-slate-200 p-3">
              <div className="font-bold">{emotion.label}</div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div>발생 비율 {formatPercent(emotion.ratio)}</div>
                <div className={pnlClass(emotion.averagePnl)}>평균 손익 {formatKRW(emotion.averagePnl)}</div>
                <div>승률 {formatPercent(emotion.winRate)}</div>
                <div>상관관계 {emotion.correlation}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card mt-5 p-4">
        <div className="mb-3 text-lg font-black">복기 노트</div>
        <div className="grid gap-3 md:grid-cols-3">
          {trades.slice(-3).reverse().map((trade) => (
            <div key={trade.id} className="rounded-md border border-slate-200 p-3">
              <div className={`text-xs font-bold ${pnlClass(trade.realizedPnl)}`}>{trade.realizedPnl >= 0 ? "수익 거래" : "손실 거래"}</div>
              <div className="mt-1 font-bold">{trade.instrumentName}</div>
              <div className="mt-2 text-sm text-slate-600">{trade.reviewMemo}</div>
              <div className="mt-2 text-xs text-slate-500">인사이트: {trade.emotionTags.includes("impatience") ? "조급함 태그가 붙은 거래의 손실 비율을 점검해보세요." : trade.marketType === "futures" ? "선물 거래 손익 변동성이 현물보다 클 수 있습니다." : "오전장 성과와 종목 반복 손실 여부를 함께 확인해보세요."}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function aggregate(trades: Trade[], keyer: (trade: Trade) => string) {
  const map = new Map<string, number>();
  trades.forEach((trade) => map.set(keyer(trade), (map.get(keyer(trade)) ?? 0) + trade.realizedPnl));
  return Array.from(map.entries()).map(([name, pnl]) => ({ name, pnl }));
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return <div className="card p-4"><div className="mb-3 text-lg font-black">{title}</div><ResponsiveContainer width="100%" height={260}>{children}</ResponsiveContainer></div>;
}
