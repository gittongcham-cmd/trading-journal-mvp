"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildCumulativePnlSeries, buildMonthlyMarketPnl, calculateWinRate, getClosedTrades } from "@/lib/calculations";
import { formatKRW, formatNumber, formatPercent, formatSignedKRW, pnlClass } from "@/lib/format";
import { calculateOpenPositions, summarizeOpenPositions } from "@/lib/holdings";
import { loadInstrumentPrices, loadTrades } from "@/lib/store";
import type { EmotionTag, Trade } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

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
  useEffect(() => { setTrades(loadTrades()); }, []);

  const prices = loadInstrumentPrices();
  const closed = getClosedTrades(trades);
  const profits = closed.filter((trade) => trade.realizedPnl > 0);
  const losses = closed.filter((trade) => trade.realizedPnl < 0);
  const realizedPnl = closed.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const spotRealizedPnl = closed.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const futuresRealizedPnl = closed.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const positions = useMemo(() => calculateOpenPositions(trades, prices), [trades, prices]);
  const positionSummary = useMemo(() => summarizeOpenPositions(positions), [positions]);
  const spotPositions = positions.filter((position) => position.marketType === "spot");
  const futuresPositions = positions.filter((position) => position.marketType === "futures");
  const spotUnrealized = spotPositions.reduce((sum, position) => sum + (position.unrealizedPnl ?? 0), 0);
  const futuresUnrealized = futuresPositions.reduce((sum, position) => sum + (position.unrealizedPnl ?? 0), 0);
  const averageProfit = profits.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(profits.length, 1);
  const averageLoss = losses.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(losses.length, 1);
  const profitLossRatio = Math.abs(averageProfit / (averageLoss || -1));
  const monthly = useMemo(() => aggregate(closed, (trade) => realizedDate(trade).slice(0, 7)), [closed]);
  const weekly = useMemo(() => aggregate(closed, (trade) => toWeekLabel(realizedDate(trade))), [closed]);
  const cumulativePnlSeries = useMemo(() => buildCumulativePnlSeries(trades), [trades]);
  const monthlyMarketPnl = useMemo(() => buildMonthlyMarketPnl(trades), [trades]);
  const byInstrument = useMemo(() => aggregate(closed, (trade) => trade.instrumentName).sort((a, b) => b.pnl - a.pnl), [closed]);
  const emotionStats = (Object.keys(emotionLabels) as EmotionTag[]).map((tag) => {
    const tagged = closed.filter((trade) => trade.emotionTags.includes(tag));
    const wins = tagged.filter((trade) => trade.realizedPnl > 0).length;
    const lossCount = tagged.filter((trade) => trade.realizedPnl < 0).length;
    return {
      tag,
      label: emotionLabels[tag],
      count: tagged.length,
      averagePnl: tagged.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(tagged.length, 1),
      winRate: tagged.length ? (wins / tagged.length) * 100 : 0,
      lossRatio: tagged.length ? (lossCount / tagged.length) * 100 : 0
    };
  });
  const insight = buildInsight(emotionStats, futuresRealizedPnl, spotRealizedPnl, positions);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-950">통계/복기</h1>
        <p className="mt-1 text-sm text-slate-500">내가 어떤 거래에서 벌고 잃는지 실현손익, 미실현손익, 감정 태그를 나눠 봅니다.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-black">실현손익 요약</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="전체 실현손익" value={formatKRW(realizedPnl)} tone="pnl" caption="청산 완료 거래 기준" />
          <KpiCard label="현물 실현손익" value={formatKRW(spotRealizedPnl)} tone="pnl" caption="현물 청산 거래" />
          <KpiCard label="선물 실현손익" value={formatKRW(futuresRealizedPnl)} tone="pnl" caption="선물 청산 거래" />
          <KpiCard label="손익비" value={formatNumber(profitLossRatio, 2)} caption="평균수익 / 평균손실" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black">미실현손익 요약</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="보유 포지션 미실현손익" value={formatKRW(positionSummary.unrealizedPnl)} tone="pnl" caption="현재가 입력분 기준" />
          <KpiCard label="현물 미실현손익" value={formatKRW(spotUnrealized)} tone="pnl" caption="보유 현물" />
          <KpiCard label="선물 미실현손익" value={formatKRW(futuresUnrealized)} tone="pnl" caption="보유 선물" />
          <KpiCard label="평가수익률" value={formatPercent(positionSummary.valuationReturnRate)} tone="pnl" caption="현재가 입력분 기준" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Chart title="현물 / 선물 누적수익 추이" description="청산 완료된 거래의 실현손익을 기준으로 현물과 선물의 누적수익을 비교해요.">
          {cumulativePnlSeries.length ? (
            <LineChart data={cumulativePnlSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} width={56} />
              <Tooltip formatter={(value, name) => [formatSignedKRW(Number(value)), name]} />
              <Line type="monotone" dataKey="total" name="전체 누적수익" stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="spot" name="현물 누적수익" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="futures" name="선물 누적수익" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : <EmptyChartMessage />}
        </Chart>
        <Chart title="월별 현물 / 선물 실현손익" description="월별로 현물과 선물에서 확정된 손익을 나눠서 보여줘요.">
          {monthlyMarketPnl.length ? (
            <BarChart data={monthlyMarketPnl}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} width={56} />
              <Tooltip formatter={(value, name) => [formatSignedKRW(Number(value)), name]} />
              <Bar dataKey="spot" name="현물 실현손익" fill="#ef4444" radius={[6, 6, 0, 0]} />
              <Bar dataKey="futures" name="선물 실현손익" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : <EmptyChartMessage />}
        </Chart>
        <Chart title="월별 전체 실현손익"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatSignedKRW(Number(value))} /><Bar dataKey="pnl">{monthly.map((item) => <Cell key={item.name} fill={item.pnl >= 0 ? "#ef4444" : "#3b82f6"} />)}</Bar></BarChart></Chart>
        <Chart title="주별 실현손익"><BarChart data={weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatSignedKRW(Number(value))} /><Bar dataKey="pnl">{weekly.map((item) => <Cell key={item.name} fill={item.pnl >= 0 ? "#ef4444" : "#3b82f6"} />)}</Bar></BarChart></Chart>
        <Chart title="종목별 성과 TOP 5"><BarChart data={byInstrument.slice(0, 5)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatSignedKRW(Number(value))} /><Bar dataKey="pnl" fill="#0f766e" /></BarChart></Chart>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-black">시장별 성과</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <MiniStat label="현물 승률" value={formatPercent(calculateWinRate(closed.filter((trade) => trade.marketType === "spot")))} />
            <MiniStat label="선물 승률" value={formatPercent(calculateWinRate(closed.filter((trade) => trade.marketType === "futures")))} />
            <MiniStat label="현물 평균 손익" value={formatKRW(averageByMarket(closed, "spot"))} />
            <MiniStat label="선물 평균 손익" value={formatKRW(averageByMarket(closed, "futures"))} />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-black">한 줄 인사이트</h2>
          <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-800">{insight}</p>
          <p className="mt-3 text-sm font-semibold text-slate-500">다음 거래에서는 손실이 반복된 종목, 조급함 태그, 미청산 포지션 규모를 먼저 확인해보세요.</p>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-black">감정 태그 분석</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {emotionStats.map((emotion) => (
            <div key={emotion.tag} className="rounded-xl border border-slate-200 p-3">
              <div className="font-bold">{emotion.label}</div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div>거래 횟수 {emotion.count}건</div>
                <div className={pnlClass(emotion.averagePnl)}>평균 손익 {formatKRW(emotion.averagePnl)}</div>
                <div>승률 {formatPercent(emotion.winRate)}</div>
                <div>손실 비중 {formatPercent(emotion.lossRatio)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-black">복기 노트</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {trades.slice(-3).reverse().map((trade) => (
            <div key={trade.id} className="rounded-xl border border-slate-200 p-3">
              <div className={`text-xs font-bold ${pnlClass(trade.realizedPnl)}`}>{trade.realizedPnl >= 0 ? "수익 거래" : "손실 거래"}</div>
              <div className="mt-1 font-bold">{trade.instrumentName}</div>
              <div className="mt-2 text-sm text-slate-600">{trade.reviewMemo || "복기 메모가 아직 없습니다."}</div>
            </div>
          ))}
          {!trades.length && <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">거래를 기록하면 최근 복기 메모가 여기에 모입니다.</div>}
        </div>
      </section>
    </div>
  );
}

function aggregate(trades: Trade[], keyer: (trade: Trade) => string) {
  const map = new Map<string, number>();
  trades.forEach((trade) => map.set(keyer(trade), (map.get(keyer(trade)) ?? 0) + trade.realizedPnl));
  return Array.from(map.entries()).map(([name, pnl]) => ({ name, pnl }));
}

function toWeekLabel(dateText: string) {
  const date = new Date(dateText);
  return `${date.getMonth() + 1}월 ${Math.ceil(date.getDate() / 7)}주`;
}

function realizedDate(trade: Trade): string {
  return trade.exitDate ?? trade.tradeDate;
}

function averageByMarket(trades: Trade[], marketType: "spot" | "futures") {
  const filtered = trades.filter((trade) => trade.marketType === marketType);
  return filtered.reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.max(filtered.length, 1);
}

function buildInsight(emotions: { label: string; averagePnl: number; count: number }[], futuresPnl: number, spotPnl: number, positions: unknown[]) {
  const worstEmotion = emotions.filter((emotion) => emotion.count > 0).sort((a, b) => a.averagePnl - b.averagePnl)[0];
  if (worstEmotion) return `${worstEmotion.label} 태그가 붙은 거래의 평균 손익이 가장 낮습니다. 다음 거래 전 같은 감정이 반복되는지 먼저 확인해보세요.`;
  if (Math.abs(futuresPnl) > Math.abs(spotPnl)) return "선물 거래의 변동성이 현물보다 큽니다. 계약수와 손절 기준을 먼저 점검해보세요.";
  if (positions.length) return "청산하지 않은 포지션의 미실현손익이 전체 성과에 영향을 줄 수 있습니다.";
  return "거래 기록을 쌓으면 시장별, 종목별, 감정별 인사이트가 자동으로 정리됩니다.";
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="label">{label}</div><div className="mt-2 text-lg font-black text-slate-900">{value}</div></div>;
}

function EmptyChartMessage() {
  return <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 p-5 text-center text-sm font-semibold leading-6 text-slate-500">아직 청산 완료된 거래가 없어 누적수익 그래프를 만들 수 없어요.<br />매도/청산 기록을 추가하면 현물과 선물 수익 추이를 볼 수 있어요.</div>;
}

function Chart({ title, description, children }: { title: string; description?: string; children: React.ReactElement }) {
  return <div className="card p-4"><div className="text-lg font-black">{title}</div>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}<div className="mt-3 h-[280px]"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>;
}
