"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calculateWinRate } from "@/lib/calculations";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { calculateSpotHoldings, summarizeSpotHoldings } from "@/lib/holdings";
import { isAdminMode } from "@/lib/auth";
import { loadInstrumentPrices, loadTrades, saveInstrumentPrice } from "@/lib/store";
import type { InstrumentPrice, MarketFilter, Trade } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

export function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [market, setMarket] = useState<MarketFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Trade | null>(null);
  const [prices, setPrices] = useState<Record<string, InstrumentPrice>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const admin = isAdminMode();

  useEffect(() => {
    const loaded = loadTrades();
    setTrades(loaded);
    setSelected(loaded[0] ?? null);
    setPrices(loadInstrumentPrices());
  }, []);

  const filtered = useMemo(
    () => trades.filter((trade) => (market === "all" || trade.marketType === market) && `${trade.instrumentName}${trade.instrumentCode}`.toLowerCase().includes(query.toLowerCase())),
    [trades, market, query]
  );
  const realized = filtered.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const spotPnl = filtered.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const futuresPnl = filtered.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const average = realized / Math.max(filtered.length, 1);
  const spotHoldings = useMemo(() => calculateSpotHoldings(trades, prices), [trades, prices]);
  const holdingsSummary = useMemo(() => summarizeSpotHoldings(spotHoldings), [spotHoldings]);

  function beginPriceEdit(holding: { instrumentId: string; currentPrice?: number }) {
    setEditingPriceId(holding.instrumentId);
    setPriceDraft(holding.currentPrice ? holding.currentPrice.toLocaleString("ko-KR") : "");
  }

  function savePrice(holding: { instrumentId: string; instrumentCode: string; instrumentName: string }) {
    const currentPrice = Number(priceDraft.replace(/,/g, ""));
    if (!currentPrice) return;
    const next = saveInstrumentPrice({
      instrumentId: holding.instrumentId,
      instrumentCode: holding.instrumentCode,
      instrumentName: holding.instrumentName,
      currentPrice,
      updatedAt: new Date().toISOString()
    });
    setPrices(next);
    setEditingPriceId(null);
    setPriceDraft("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">매매일지</h1>
          <p className="mt-1 text-sm text-slate-500">현물과 선물 거래를 같은 기준으로 기록하고 복기합니다.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" type="button">CSV 업로드</button>
          {admin && <Link className="btn btn-primary" href="/trades/new">+ 거래 추가</Link>}
        </div>
      </div>

      <div className="card p-4">
        <div className="grid gap-3 lg:grid-cols-[160px_160px_260px_1fr]">
          <input className="input" type="date" defaultValue="2026-06-28" />
          <input className="input" type="date" defaultValue="2026-07-03" />
          <div className="flex rounded-lg border border-slate-300 p-1">
            {[
              ["all", "전체"],
              ["spot", "현물"],
              ["futures", "선물"]
            ].map(([value, label]) => (
              <button key={value} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${market === value ? "bg-blue-600 text-white" : "text-slate-600"}`} type="button" onClick={() => setMarket(value as MarketFilter)}>{label}</button>
            ))}
          </div>
          <input className="input" placeholder="종목명 또는 코드 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="총 거래수" value={`${filtered.length}건`} />
        <KpiCard label="실현손익" value={formatKRW(realized)} tone="pnl" />
        <KpiCard label="현물 누적수익" value={formatKRW(spotPnl)} tone="pnl" />
        <KpiCard label="선물 누적수익" value={formatKRW(futuresPnl)} tone="pnl" />
        <KpiCard label="총 투자금액" value={formatKRW(holdingsSummary.totalInvestmentAmount)} />
        <KpiCard label="보유 종목 현재금액" value={formatKRW(holdingsSummary.totalCurrentAmount)} />
        <KpiCard label="평가손익" value={formatKRW(holdingsSummary.valuationPnl)} tone="pnl" />
        <KpiCard label="평가수익률" value={formatPercent(holdingsSummary.valuationReturnRate)} tone="pnl" />
        <KpiCard label="평균 손익" value={formatKRW(average)} tone="pnl" />
        <KpiCard label="승률" value={formatPercent(calculateWinRate(filtered))} />
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">현재 보유 현물 종목</h2>
          <p className="mt-1 text-sm text-slate-500">현물 주식/ETF/ETN 보유 포지션만 기준으로 평가합니다. 선물은 포함하지 않습니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                {["종목명", "종목코드", "보유수량", "평균매수가", "투자금액", "현재가", "현재금액", "평가손익", "평가수익률"].map((head, index) => (
                  <th key={head} className={`px-4 py-3 ${index >= 2 ? "text-right" : "text-left"}`}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spotHoldings.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-sm font-semibold text-slate-500" colSpan={9}>현재 보유 중인 현물 종목이 없습니다.</td></tr>
              )}
              {spotHoldings.map((holding) => (
                <tr key={holding.instrumentId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">{holding.instrumentName}</td>
                  <td className="px-4 py-3">{holding.instrumentCode}</td>
                  <td className="px-4 py-3 text-right">{holding.quantity.toLocaleString("ko-KR")}주</td>
                  <td className="px-4 py-3 text-right">{formatKRW(holding.averageEntryPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatKRW(holding.investmentAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    {editingPriceId === holding.instrumentId ? (
                      <div className="flex justify-end gap-2">
                        <input
                          className="input max-w-36 text-right"
                          value={priceDraft}
                          onChange={(event) => setPriceDraft(formatNumberInput(event.target.value))}
                          placeholder="현재가"
                        />
                        <button className="btn btn-primary" type="button" onClick={() => savePrice(holding)}>저장</button>
                      </div>
                    ) : (
                      <button className="font-bold text-blue-600 underline-offset-2 hover:underline disabled:cursor-default disabled:no-underline" type="button" onClick={() => beginPriceEdit(holding)} disabled={!admin}>
                        {holding.currentPrice === undefined ? "현재가 입력 필요" : `${holding.currentPrice.toLocaleString("ko-KR")}원`}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{holding.currentAmount === undefined ? "-" : formatKRW(holding.currentAmount)}</td>
                  <td className={`px-4 py-3 text-right font-black ${holding.valuationPnl === undefined ? "text-slate-400" : pnlClass(holding.valuationPnl)}`}>
                    {holding.valuationPnl === undefined ? "-" : formatKRW(holding.valuationPnl)}
                  </td>
                  <td className={`px-4 py-3 text-right font-black ${holding.valuationReturnRate === undefined ? "text-slate-400" : pnlClass(holding.valuationReturnRate)}`}>
                    {holding.valuationReturnRate === undefined ? "-" : formatPercent(holding.valuationReturnRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1560px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                {["날짜", "시장", "상품구분", "종목", "종목코드", "포지션", "거래유형", "진입가", "청산가", "수량/계약수", "거래금액", "예상 수수료", "손익", "전체 누적손익", "시장 누적손익", "진입이유", "청산이유", "감정메모"].map((head, index) => (
                  <th key={head} className={`px-4 py-3 ${index >= 7 && index <= 14 ? "text-right" : "text-left"}`}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((trade) => (
                <tr key={trade.id} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/40 ${selected?.id === trade.id ? "bg-blue-50" : ""}`} onClick={() => setSelected(trade)}>
                  <td className="px-4 py-3">{trade.tradeDate}</td>
                  <td className="px-4 py-3"><MarketPill market={trade.marketType} /></td>
                  <td className="px-4 py-3">{trade.assetType}</td>
                  <td className="px-4 py-3 font-bold">{trade.instrumentName}</td>
                  <td className="px-4 py-3">{trade.instrumentCode}</td>
                  <td className="px-4 py-3"><SidePill side={trade.positionSide} /></td>
                  <td className="px-4 py-3">{trade.tradeAction}</td>
                  <td className="px-4 py-3 text-right">{trade.entryPrice.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right">{trade.exitPrice?.toLocaleString("ko-KR") ?? "-"}</td>
                  <td className="px-4 py-3 text-right">{trade.marketType === "spot" ? `${trade.quantity ?? 0}주` : `${trade.contractCount ?? 0}계약`}</td>
                  <td className="px-4 py-3 text-right">{formatKRW(trade.tradeAmount)}</td>
                  <td className="px-4 py-3 text-right">{formatKRW(trade.fee)}</td>
                  <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.realizedPnl)}`}>{formatKRW(trade.realizedPnl)}</td>
                  <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.cumulativePnl)}`}>{formatKRW(trade.cumulativePnl)}</td>
                  <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.marketCumulativePnl)}`}>{formatKRW(trade.marketCumulativePnl)}</td>
                  <td className="px-4 py-3">{trade.entryReason}</td>
                  <td className="px-4 py-3">{trade.exitReason || "-"}</td>
                  <td className="px-4 py-3">{trade.emotionTags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">상세 패널 · {selected.instrumentName}</h2>
            <MarketPill market={selected.marketType} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Detail label="매수/매도" value={selected.positionSide === "long" ? "매수" : "매도"} />
            <Detail label="진입 시점" value={selected.entryDate ?? "-"} />
            <Detail label="청산 시점" value={selected.exitDate ?? "-"} />
            <Detail label="거래금액" value={formatKRW(selected.tradeAmount)} alignRight />
            <Detail label="예상 수수료" value={formatKRW(selected.fee)} alignRight />
            <Detail label="손익" value={formatKRW(selected.realizedPnl)} className={pnlClass(selected.realizedPnl)} alignRight />
            <Detail label="수익률" value={formatPercent(selected.returnRate)} alignRight />
            <Detail label="목표가" value={selected.targetPrice?.toLocaleString("ko-KR") ?? "-"} alignRight />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Memo label="진입이유" value={selected.entryReason} />
            <Memo label="청산이유" value={selected.exitReason || "-"} />
            <Memo label="감정 태그" value={selected.emotionTags.join(", ")} />
            <Memo label="복기 메모" value={selected.reviewMemo} />
          </div>
        </div>
      )}
    </div>
  );
}

function MarketPill({ market }: { market: "spot" | "futures" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${market === "spot" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}>{market === "spot" ? "현물" : "선물"}</span>;
}

function SidePill({ side }: { side: "long" | "short" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${side === "long" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{side === "long" ? "매수" : "매도"}</span>;
}

function Detail({ label, value, className = "", alignRight = false }: { label: string; value: string; className?: string; alignRight?: boolean }) {
  return <div className={`rounded-xl border border-slate-200 p-3 ${alignRight ? "text-right" : ""}`}><div className="label">{label}</div><div className={`mt-1 text-sm font-black text-slate-800 ${className}`}>{value}</div></div>;
}

function Memo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><div className="label">{label}</div><div className="mt-2 text-sm font-semibold text-slate-700">{value}</div></div>;
}

function formatNumberInput(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return Number(cleaned).toLocaleString("ko-KR");
}
