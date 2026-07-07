"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isAdminMode } from "@/lib/auth";
import { calculateWinRate } from "@/lib/calculations";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { calculateOpenPositions, summarizeOpenPositions } from "@/lib/holdings";
import { updateManualPrice } from "@/lib/quotes";
import { loadInstrumentPrices, loadTrades } from "@/lib/store";
import type { InstrumentPrice, MarketFilter, PositionHoldingSummary, Trade } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

export function TradesPage() {
  const admin = isAdminMode();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [market, setMarket] = useState<MarketFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Trade | null>(null);
  const [prices, setPrices] = useState<Record<string, InstrumentPrice>>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

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
  const closed = filtered.filter((trade) => trade.tradeAction !== "entry" || trade.exitPrice !== undefined);
  const realized = closed.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const spotPnl = closed.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const futuresPnl = closed.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const average = realized / Math.max(closed.length, 1);
  const positions = useMemo(() => calculateOpenPositions(trades, prices), [trades, prices]);
  const positionSummary = useMemo(() => summarizeOpenPositions(positions), [positions]);

  function beginPriceEdit(position: PositionHoldingSummary) {
    setEditingCode(position.instrumentCode);
    setPriceDraft(position.currentPrice ? position.currentPrice.toLocaleString("ko-KR") : "");
  }

  function savePrice(position: PositionHoldingSummary) {
    const currentPrice = Number(priceDraft.replace(/,/g, ""));
    if (!currentPrice) return;
    const next = updateManualPrice({
      instrumentCode: position.instrumentCode,
      instrumentName: position.instrumentName,
      marketType: position.marketType,
      currentPrice
    });
    setPrices(next);
    setEditingCode(null);
    setPriceDraft("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">매매일지</h1>
          <p className="mt-1 text-sm text-slate-500">청산 거래의 실현손익과 보유 포지션의 미실현손익을 나눠서 봅니다.</p>
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
        <KpiCard label="총 거래수" value={`${filtered.length}건`} caption="필터 기준" />
        <KpiCard label="실현손익" value={formatKRW(realized)} tone="pnl" caption="청산 완료 거래 기준" />
        <KpiCard label="현물 누적수익" value={formatKRW(spotPnl)} tone="pnl" caption="현물 실현손익" />
        <KpiCard label="선물 누적수익" value={formatKRW(futuresPnl)} tone="pnl" caption="선물 실현손익" />
        <KpiCard label="총 투자금액" value={formatKRW(positionSummary.totalInvestmentAmount)} caption="보유 현물 기준" />
        <KpiCard label="보유 종목 현재금액" value={formatKRW(positionSummary.totalCurrentAmount)} caption="현재가 입력분" />
        <KpiCard label="미실현손익" value={formatKRW(positionSummary.unrealizedPnl)} tone="pnl" caption={positionSummary.missingPriceCount ? `${positionSummary.missingPriceCount}개 현재가 입력 필요` : "현물+선물 보유 포지션"} />
        <KpiCard label="평가수익률" value={formatPercent(positionSummary.valuationReturnRate)} tone="pnl" caption="현재가 입력분 기준" />
        <KpiCard label="평균 손익" value={formatKRW(average)} tone="pnl" caption="청산 거래 평균" />
        <KpiCard label="승률" value={formatPercent(calculateWinRate(closed))} caption="청산 거래 기준" />
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">현재 보유 포지션</h2>
          <p className="mt-1 text-sm text-slate-500">현재가를 입력하면 평가손익을 계산할 수 있어요. 수동 입력값은 QuoteProvider에 저장됩니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["시장", "종목", "보유수량/계약수", "평균진입가", "투자금액/명목금액", "현재가", "현재금액", "미실현손익", "평가수익률", "현재가 업데이트"].map((head, index) => <th key={head} className={`px-4 py-3 ${index >= 2 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {!positions.length && <tr><td className="px-4 py-6 text-center text-sm font-semibold text-slate-500" colSpan={10}>아직 보유 중인 포지션이 없습니다. 신규 진입 거래를 남기면 이곳에 표시됩니다.</td></tr>}
              {positions.map((position) => (
                <tr key={position.id} className="border-t border-slate-100">
                  <td className="px-4 py-3"><MarketPill market={position.marketType} /></td>
                  <td className="px-4 py-3 font-bold">{position.instrumentName}</td>
                  <td className="px-4 py-3 text-right">{position.marketType === "spot" ? `${position.quantity.toLocaleString("ko-KR")}주` : `${position.quantity.toLocaleString("ko-KR")}계약`}</td>
                  <td className="px-4 py-3 text-right">{position.marketType === "spot" ? formatKRW(position.averageEntryPrice) : `${position.averageEntryPrice.toLocaleString("ko-KR")}pt`}</td>
                  <td className="px-4 py-3 text-right">{formatKRW(position.investmentAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    {editingCode === position.instrumentCode ? (
                      <div className="flex justify-end gap-2">
                        <input className="input max-w-36 text-right" value={priceDraft} onChange={(event) => setPriceDraft(formatNumberInput(event.target.value))} placeholder="현재가" />
                        <button className="btn btn-primary" type="button" onClick={() => savePrice(position)}>저장</button>
                      </div>
                    ) : (
                      <button className="font-bold text-blue-600 underline-offset-2 hover:underline disabled:cursor-default disabled:no-underline" type="button" onClick={() => beginPriceEdit(position)} disabled={!admin}>
                        {position.currentPrice === undefined ? "현재가 입력 필요" : position.marketType === "spot" ? formatKRW(position.currentPrice) : `${position.currentPrice.toLocaleString("ko-KR")}pt`}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{position.currentAmount === undefined ? "-" : formatKRW(position.currentAmount)}</td>
                  <td className={`px-4 py-3 text-right font-black ${position.unrealizedPnl === undefined ? "text-slate-400" : pnlClass(position.unrealizedPnl)}`}>{position.unrealizedPnl === undefined ? "-" : formatKRW(position.unrealizedPnl)}</td>
                  <td className={`px-4 py-3 text-right font-black ${position.returnRate === undefined ? "text-slate-400" : pnlClass(position.returnRate)}`}>{position.returnRate === undefined ? "-" : formatPercent(position.returnRate)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{position.updatedAt ? new Date(position.updatedAt).toLocaleString("ko-KR") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">거래 기록</h2>
          <p className="mt-1 text-sm text-slate-500">청산 완료 거래는 실현손익을, 보유 거래는 현재가 기준 미실현손익을 별도로 확인합니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1840px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["날짜", "시장", "상품구분", "종목", "종목코드", "포지션", "거래유형", "진입가", "청산가", "수량/계약수", "거래금액", "예상 수수료", "실현손익", "전체 누적손익", "시장 누적손익", "현재가", "현재금액", "미실현손익", "평가수익률", "현재가 업데이트", "진입이유", "청산이유", "감정메모"].map((head, index) => (
                <th key={head} className={`px-4 py-3 ${index >= 7 && index <= 19 ? "text-right" : "text-left"}`}>{head}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((trade) => {
                const position = positions.find((item) => item.instrumentCode === trade.instrumentCode);
                const open = trade.tradeAction === "entry" && position;
                return (
                  <tr key={trade.id} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/40 ${selected?.id === trade.id ? "bg-blue-50" : ""}`} onClick={() => setSelected(trade)}>
                    <td className="px-4 py-3">{trade.tradeDate}</td>
                    <td className="px-4 py-3"><MarketPill market={trade.marketType} /></td>
                    <td className="px-4 py-3">{trade.assetType}</td>
                    <td className="px-4 py-3 font-bold">{trade.instrumentName}</td>
                    <td className="px-4 py-3">{trade.instrumentCode}</td>
                    <td className="px-4 py-3">{trade.positionSide === "long" ? "매수" : "매도"}</td>
                    <td className="px-4 py-3">{trade.tradeAction}</td>
                    <td className="px-4 py-3 text-right">{trade.entryPrice.toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-3 text-right">{trade.exitPrice?.toLocaleString("ko-KR") ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{trade.marketType === "spot" ? `${trade.quantity ?? 0}주` : `${trade.contractCount ?? 0}계약`}</td>
                    <td className="px-4 py-3 text-right">{formatKRW(trade.tradeAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatKRW(trade.fee)}</td>
                    <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.realizedPnl)}`}>{formatKRW(trade.realizedPnl)}</td>
                    <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.cumulativePnl)}`}>{formatKRW(trade.cumulativePnl)}</td>
                    <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.marketCumulativePnl)}`}>{formatKRW(trade.marketCumulativePnl)}</td>
                    <td className="px-4 py-3 text-right">{open ? position.currentPrice === undefined ? "현재가 입력 필요" : trade.marketType === "spot" ? formatKRW(position.currentPrice) : `${position.currentPrice.toLocaleString("ko-KR")}pt` : "-"}</td>
                    <td className="px-4 py-3 text-right">{open && position.currentAmount !== undefined ? formatKRW(position.currentAmount) : "-"}</td>
                    <td className={`px-4 py-3 text-right font-black ${open && position.unrealizedPnl !== undefined ? pnlClass(position.unrealizedPnl) : "text-slate-400"}`}>{open && position.unrealizedPnl !== undefined ? formatKRW(position.unrealizedPnl) : "-"}</td>
                    <td className={`px-4 py-3 text-right font-black ${open && position.returnRate !== undefined ? pnlClass(position.returnRate) : "text-slate-400"}`}>{open && position.returnRate !== undefined ? formatPercent(position.returnRate) : "-"}</td>
                    <td className="px-4 py-3 text-right">{open && position.updatedAt ? new Date(position.updatedAt).toLocaleString("ko-KR") : "-"}</td>
                    <td className="px-4 py-3">{trade.entryReason}</td>
                    <td className="px-4 py-3">{trade.exitReason || "-"}</td>
                    <td className="px-4 py-3">{trade.emotionTags.join(", ")}</td>
                  </tr>
                );
              })}
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
            <Detail label="실현손익" value={formatKRW(selected.realizedPnl)} className={pnlClass(selected.realizedPnl)} alignRight />
            <Detail label="수익률" value={formatPercent(selected.returnRate)} alignRight />
            <Detail label="목표가" value={selected.targetPrice?.toLocaleString("ko-KR") ?? "-"} alignRight />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Memo label="진입이유" value={selected.entryReason || "-"} />
            <Memo label="청산이유" value={selected.exitReason || "-"} />
            <Memo label="감정 태그" value={selected.emotionTags.join(", ")} />
            <Memo label="복기 메모" value={selected.reviewMemo || "-"} />
          </div>
        </div>
      )}
    </div>
  );
}

function MarketPill({ market }: { market: "spot" | "futures" }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${market === "spot" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"}`}>{market === "spot" ? "현물" : "선물"}</span>;
}

function Detail({ label, value, className = "", alignRight = false }: { label: string; value: string; className?: string; alignRight?: boolean }) {
  return <div className={`rounded-xl border border-slate-200 p-3 ${alignRight ? "text-right" : ""}`}><div className="label">{label}</div><div className={`mt-1 text-sm font-black text-slate-800 ${className}`}>{value}</div></div>;
}

function Memo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><div className="label">{label}</div><div className="mt-2 text-sm font-semibold text-slate-700">{value}</div></div>;
}

function formatNumberInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";
  const [integer, decimal] = cleaned.split(".");
  const formatted = Number(integer || 0).toLocaleString("ko-KR");
  return decimal === undefined ? formatted : `${formatted}.${decimal}`;
}
