"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isAdminMode } from "@/lib/auth";
import { buildCumulativePnlSeries, calculateFuturesFee, calculateReturnRate, calculateWinRate } from "@/lib/calculations";
import { formatKRW, formatPercent, formatSignedKRW, pnlClass } from "@/lib/format";
import { calculateOpenPositions, summarizeOpenPositions } from "@/lib/holdings";
import { updateManualPrice } from "@/lib/quotes";
import { loadAppSettings, loadInstrumentPrices, loadTrades, saveAppSettings, saveTrades } from "@/lib/store";
import type { Currency, EmotionTag, InstrumentPrice, MarketFilter, PositionHoldingSummary, Trade, TradeAction } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

const emotionOptions: { value: EmotionTag; label: string }[] = [
  { value: "confidence", label: "자신감" },
  { value: "anxiety", label: "불안" },
  { value: "impatience", label: "조급함" },
  { value: "greed", label: "욕심" },
  { value: "fear", label: "공포" },
  { value: "calm", label: "평온" },
  { value: "regret", label: "후회" },
  { value: "conviction", label: "확신" }
];

type ExitDraft = {
  date: string;
  quantity: string;
  price: string;
  fee: string;
  memo: string;
  exitReason: string;
  emotionTags: EmotionTag[];
};

type ImportPreviewRow = {
  id: string;
  include: boolean;
  date: string;
  instrumentName: string;
  position: string;
  contractCount: string;
  entryPrice: string;
  exitPrice: string;
  fee: string;
  realizedPnl: string;
  entryReason: string;
  exitReason: string;
  memo: string;
  emotionTags: string;
  status: string;
};

type RecordDateFilter = "all" | "this_month" | "last_month" | "month" | "custom";
type TradeDisplayStatus = "open" | "partial_closed" | "closed";
type RecordStatusFilter = "all" | TradeDisplayStatus;
type RecordPnlFilter = "all" | "profit" | "loss" | "zero";
type RecordSideFilter = "all" | "buy" | "sell" | "long" | "short";
type RecordAssetFilter = "all" | "stock" | "etf" | "futures";
type RecordSortKey = "date" | "instrumentName" | "marketType" | "entryPrice" | "exitPrice" | "realizedPnl" | "status";
type SortDirection = "asc" | "desc";

type RecordFilters = {
  dateFilter: RecordDateFilter;
  month: string;
  fromDate: string;
  toDate: string;
  market: MarketFilter;
  status: RecordStatusFilter;
  pnl: RecordPnlFilter;
  search: string;
  side: RecordSideFilter;
  asset: RecordAssetFilter;
};

export function TradesPage() {
  const admin = isAdminMode();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [market, setMarket] = useState<MarketFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Trade | null>(null);
  const [prices, setPrices] = useState<Record<string, InstrumentPrice>>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [editingPosition, setEditingPosition] = useState<PositionHoldingSummary | null>(null);
  const [positionDraft, setPositionDraft] = useState({ code: "", exchange: "", currency: "KRW" as Currency, memo: "" });
  const [closingPosition, setClosingPosition] = useState<PositionHoldingSummary | null>(null);
  const [exitDraft, setExitDraft] = useState<ExitDraft>(createExitDraft());
  const [exitError, setExitError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const [showGoogleSheetImport, setShowGoogleSheetImport] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [hideImportAfterSave, setHideImportAfterSave] = useState(false);
  const [recordDateFilter, setRecordDateFilter] = useState<RecordDateFilter>("all");
  const [recordMonth, setRecordMonth] = useState("");
  const [recordFromDate, setRecordFromDate] = useState("");
  const [recordToDate, setRecordToDate] = useState("");
  const [recordMarket, setRecordMarket] = useState<MarketFilter>("all");
  const [recordStatus, setRecordStatus] = useState<RecordStatusFilter>("all");
  const [recordPnl, setRecordPnl] = useState<RecordPnlFilter>("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordSide, setRecordSide] = useState<RecordSideFilter>("all");
  const [recordAsset, setRecordAsset] = useState<RecordAssetFilter>("all");
  const [recordSortKey, setRecordSortKey] = useState<RecordSortKey>("date");
  const [recordSortDirection, setRecordSortDirection] = useState<SortDirection>("desc");
  const [collapsedMonths, setCollapsedMonths] = useState<string[]>([]);

  useEffect(() => {
    const loaded = loadTrades();
    setTrades(loaded);
    setSelected(loaded[0] ?? null);
    setPrices(loadInstrumentPrices());
    setShowGoogleSheetImport(loadAppSettings().showGoogleSheetImport);
  }, []);

  const filtered = useMemo(
    () => trades.filter((trade) => (market === "all" || trade.marketType === market) && `${trade.instrumentName}${trade.instrumentCode}`.toLowerCase().includes(query.toLowerCase())),
    [trades, market, query]
  );
  const closed = filtered.filter(isRealizedPnlTrade);
  const realized = closed.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const spotPnl = closed.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const futuresPnl = closed.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const average = realized / Math.max(closed.length, 1);
  const positions = useMemo(() => calculateOpenPositions(trades, prices), [trades, prices]);
  const positionSummary = useMemo(() => summarizeOpenPositions(positions), [positions]);
  const positionShare = useMemo(() => toPositionShare(positions), [positions]);
  const cumulativePnlSeries = useMemo(() => buildCumulativePnlSeries(trades), [trades]);
  const spotPnlSeries = useMemo(() => toSingleMarketPnlSeries(trades, "spot"), [trades]);
  const futuresPnlSeries = useMemo(() => toSingleMarketPnlSeries(trades, "futures"), [trades]);
  const tradeStatuses = useMemo(() => calculateTradeDisplayStatuses(trades), [trades]);
  const profitTop = useMemo(() => positions.filter((position) => position.unrealizedPnl !== undefined && position.unrealizedPnl > 0).sort((a, b) => (b.unrealizedPnl ?? 0) - (a.unrealizedPnl ?? 0)).slice(0, 5), [positions]);
  const lossTop = useMemo(() => positions.filter((position) => position.unrealizedPnl !== undefined && position.unrealizedPnl < 0).sort((a, b) => (a.unrealizedPnl ?? 0) - (b.unrealizedPnl ?? 0)).slice(0, 5), [positions]);
  const missingPricePositions = positions.filter((position) => position.currentPrice === undefined);
  const availableRecordMonths = useMemo(() => getAvailableMonths(trades), [trades]);
  const recordFilters = useMemo<RecordFilters>(() => ({
    dateFilter: recordDateFilter,
    month: recordMonth,
    fromDate: recordFromDate,
    toDate: recordToDate,
    market: recordMarket,
    status: recordStatus,
    pnl: recordPnl,
    search: recordSearch,
    side: recordSide,
    asset: recordAsset
  }), [recordDateFilter, recordMonth, recordFromDate, recordToDate, recordMarket, recordStatus, recordPnl, recordSearch, recordSide, recordAsset]);
  const recordFiltered = useMemo(() => filterRecordTrades(trades, recordFilters, tradeStatuses), [trades, recordFilters, tradeStatuses]);
  const recordSorted = useMemo(() => sortRecordTrades(recordFiltered, recordSortKey, recordSortDirection), [recordFiltered, recordSortKey, recordSortDirection]);
  const recordGroups = useMemo(() => groupRecordTrades(recordSorted), [recordSorted]);
  const recordSummary = useMemo(() => summarizeRecordTrades(recordFiltered), [recordFiltered]);

  function toggleRecordSort(key: RecordSortKey) {
    if (recordSortKey === key) {
      setRecordSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setRecordSortKey(key);
    setRecordSortDirection(key === "date" ? "desc" : "asc");
  }

  function toggleRecordMonth(month: string) {
    setCollapsedMonths((current) => current.includes(month) ? current.filter((item) => item !== month) : [...current, month]);
  }

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

  function beginPositionEdit(position: PositionHoldingSummary) {
    setEditingPosition(position);
    setPositionDraft({
      code: position.instrumentCode,
      exchange: position.exchange ?? "",
      currency: position.currency ?? "KRW",
      memo: ""
    });
  }

  function savePositionEdit() {
    if (!editingPosition) return;
    const nextCode = positionDraft.code.trim() || editingPosition.instrumentCode;
    const nextTrades = trades.map((trade) =>
      trade.instrumentId === editingPosition.instrumentId || trade.instrumentCode === editingPosition.instrumentCode
        ? { ...trade, instrumentCode: nextCode, exchange: positionDraft.exchange, currency: positionDraft.currency, reviewMemo: positionDraft.memo || trade.reviewMemo }
        : trade
    );
    saveTrades(nextTrades);
    setTrades(nextTrades);
    setEditingPosition(null);
  }

  function beginExit(position: PositionHoldingSummary) {
    setClosingPosition(position);
    setExitDraft(createExitDraft(position));
    setExitError("");
  }

  function toggleExitEmotion(tag: EmotionTag) {
    setExitDraft((current) => ({
      ...current,
      emotionTags: current.emotionTags.includes(tag)
        ? current.emotionTags.filter((item) => item !== tag)
        : [...current.emotionTags, tag]
    }));
  }

  function saveExitTrade() {
    if (!admin || !closingPosition) return;
    const quantity = parseNumber(exitDraft.quantity);
    const exitPrice = parseNumber(exitDraft.price);
    const manualFee = parseNumber(exitDraft.fee);

    if (!quantity) {
      setExitError(closingPosition.marketType === "futures" ? "청산계약수를 입력해 주세요." : "매도수량을 입력해 주세요.");
      return;
    }
    if (!exitPrice) {
      setExitError(closingPosition.marketType === "futures" ? "청산가를 입력해 주세요." : "매도가를 입력해 주세요.");
      return;
    }
    if (quantity > closingPosition.quantity + 0.0000001) {
      setExitError(closingPosition.marketType === "futures" ? "청산계약수는 현재 보유계약수를 초과할 수 없어요." : "보유수량보다 많이 매도할 수 없어요.");
      return;
    }
    if (closingPosition.marketType === "futures" && !Number.isInteger(quantity)) {
      setExitError("선물 청산계약수는 정수로 입력해 주세요.");
      return;
    }

    const multiplier = closingPosition.multiplier ?? 250000;
    const fee = closingPosition.marketType === "futures"
      ? calculateFuturesFee({
          entryPrice: closingPosition.averageEntryPrice,
          exitPrice,
          contractCount: quantity,
          multiplier
        })
      : manualFee;
    const tradeAmount = closingPosition.marketType === "futures"
      ? closingPosition.averageEntryPrice * multiplier * quantity
      : closingPosition.averageEntryPrice * quantity;
    const direction = closingPosition.positionSide === "long" ? 1 : -1;
    const realizedPnl = closingPosition.marketType === "futures"
      ? closingPosition.positionSide === "long"
        ? (exitPrice - closingPosition.averageEntryPrice) * multiplier * quantity - fee
        : (closingPosition.averageEntryPrice - exitPrice) * multiplier * quantity - fee
      : (exitPrice - closingPosition.averageEntryPrice) * quantity * direction - fee;
    const action: TradeAction = quantity >= closingPosition.quantity - 0.0000001 ? "full_exit" : "partial_exit";
    const now = new Date().toISOString();
    const nextTrade: Trade = {
      id: `trade-${Date.now()}`,
      tradeDate: exitDraft.date,
      marketType: closingPosition.marketType,
      assetType: closingPosition.assetType ?? (closingPosition.marketType === "futures" ? "index_futures" : "stock"),
      instrumentId: closingPosition.instrumentId,
      instrumentName: closingPosition.instrumentName,
      instrumentCode: closingPosition.instrumentCode,
      region: closingPosition.region,
      currency: closingPosition.currency ?? "KRW",
      exchange: closingPosition.exchange,
      exchangeRate: closingPosition.exchangeRate,
      positionSide: closingPosition.positionSide,
      tradeAction: action,
      entryPrice: closingPosition.averageEntryPrice,
      exitDate: exitDraft.date,
      exitPrice,
      quantity: closingPosition.marketType === "spot" ? quantity : undefined,
      contractCount: closingPosition.marketType === "futures" ? quantity : undefined,
      multiplier: closingPosition.marketType === "futures" ? multiplier : undefined,
      tradeAmount,
      fee,
      realizedPnl,
      unrealizedPnl: 0,
      cumulativePnl: 0,
      marketCumulativePnl: 0,
      returnRate: calculateReturnRate(realizedPnl, tradeAmount),
      entryReason: "보유 포지션 매도/청산",
      exitReason: exitDraft.exitReason,
      emotionTags: exitDraft.emotionTags.length ? exitDraft.emotionTags : ["calm"],
      reviewMemo: exitDraft.memo,
      createdAt: now,
      updatedAt: now
    };
    const nextTrades = [...trades, nextTrade];
    saveTrades(nextTrades);
    const reloaded = loadTrades();
    setTrades(reloaded);
    setSelected(reloaded.find((trade) => trade.id === nextTrade.id) ?? nextTrade);
    setClosingPosition(null);
    setExitDraft(createExitDraft());
    setExitError("");
  }

  function deleteTrade() {
    if (!admin || !deleteTarget) return;
    const nextTrades = trades.filter((trade) => trade.id !== deleteTarget.id);
    saveTrades(nextTrades);
    const reloaded = loadTrades();
    setTrades(reloaded);
    setSelected((current) => current?.id === deleteTarget.id ? reloaded[0] ?? null : current);
    setDeleteTarget(null);
  }

  async function loadGoogleSheet() {
    setImporting(true);
    setImportError("");
    setImportRows([]);
    try {
      const response = await fetch("/api/import/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl })
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { rows?: Record<string, string>[] };
      const previewRows = (data.rows ?? []).map((row, index) => toImportPreviewRow(row, index, trades));
      setImportRows(previewRows);
      if (!previewRows.length) {
        setImportError("가져올 거래내역이 없습니다. 첫 줄 컬럼명과 데이터 행을 확인해 주세요.");
      }
    } catch {
      setImportError("구글시트를 불러오지 못했어요. 시트가 비공개이거나 링크 접근 권한이 없을 수 있어요. 구글시트를 “링크가 있는 사용자 보기 가능”으로 바꾼 뒤 다시 시도해 주세요.");
    } finally {
      setImporting(false);
    }
  }

function updateImportRow(rowId: string, key: keyof ImportPreviewRow, value: string | boolean) {
    setImportRows((current) => current.map((row) => {
      if (row.id !== rowId) return row;
      const next = { ...row, [key]: value } as ImportPreviewRow;
      const status = getImportStatus(next, trades);
      return { ...next, status, include: key === "include" ? Boolean(value) : next.include && shouldIncludeImportRow(status) };
    }));
  }

  function saveImportedRows() {
    if (!admin) return;
    const batchId = `google-sheet-${Date.now()}`;
    const importedAt = new Date().toISOString();
    const newTrades = importRows
      .filter((row) => row.include && shouldIncludeImportRow(row.status))
      .map((row, index) => toTradeFromImportRow(row, batchId, importedAt, index));
    if (!newTrades.length) {
      setImportError("저장할 거래가 없습니다. 미리보기에서 포함할 거래를 확인해 주세요.");
      return;
    }
    saveTrades([...trades, ...newTrades]);
    const reloaded = loadTrades();
    setTrades(reloaded);
    setSelected(reloaded[0] ?? null);
    if (hideImportAfterSave) {
      const nextSettings = { ...loadAppSettings(), showGoogleSheetImport: false };
      saveAppSettings(nextSettings);
      setShowGoogleSheetImport(false);
    }
    setSheetUrl("");
    setImportRows([]);
    setImportError("");
    setHideImportAfterSave(false);
    setImportOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">매매일지</h1>
          <p className="mt-1 text-sm text-slate-500">청산 거래의 실현손익과 보유 포지션의 미실현손익을 나눠서 봅니다.</p>
        </div>
        <div className="flex gap-2">
          {admin && showGoogleSheetImport && <button className="btn btn-secondary" type="button" onClick={() => setImportOpen(true)}>구글시트 불러오기</button>}
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
          <p className="mt-1 text-sm text-slate-500">현재가가 입력된 종목은 자동으로 평가손익이 계산돼요. 현재가는 평가용이며, 실제 매도가는 매도/청산 시 직접 입력해 주세요.</p>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="총 투자금액" value={formatKRW(positionSummary.totalInvestmentAmount)} caption="보유 포지션 기준" />
            <KpiCard label="현재 평가금액" value={formatKRW(positionSummary.spotCurrentAmount + positionSummary.futuresCurrentAmount)} caption={positionSummary.missingPriceCount ? `${positionSummary.missingPriceCount}개 현재가 입력 필요` : "현재가 입력분 기준"} />
            <KpiCard label="미실현손익" value={formatKRW(positionSummary.unrealizedPnl)} tone="pnl" caption="전체 누적수익에는 포함하지 않음" />
            <KpiCard label="평가수익률" value={formatPercent(positionSummary.valuationReturnRate)} tone="pnl" caption="평가용 현재가 기준" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
            <ChartPanel title="보유 종목 비중" description="현재금액 기준으로 어떤 종목에 자산이 많이 들어가 있는지 보여줘요.">
              <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={positionShare} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
                      {positionShare.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatKRW(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <LegendList rows={positionShare} />
              </div>
            </ChartPanel>

            <ChartPanel title="수익/손실 종목 한눈에 보기" description="현재 보유 중인 종목 중 평가손익이 큰 종목을 보여줘요.">
              <div className="grid gap-4 lg:grid-cols-2">
                <TopBar title="수익 TOP 5" rows={profitTop} positive />
                <TopBar title="손실 TOP 5" rows={lossTop} />
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <ChartPanel title="현물 / 선물 누적수익 추이" description="청산 완료된 거래의 실현손익을 기준으로 현물과 선물의 누적수익을 비교해요.">
              {cumulativePnlSeries.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={cumulativePnlSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} width={56} />
                    <Tooltip formatter={(value, name) => [formatSignedKRW(Number(value)), name]} />
                    <Line type="monotone" dataKey="total" name="전체 누적수익" stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="spot" name="현물 누적수익" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="futures" name="선물 누적수익" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState />
              )}
            </ChartPanel>

            <ChartPanel title="현물 수익 추이" description="청산 완료된 현물 거래의 실현손익만 보여줘요.">
              {spotPnlSeries.length ? (
                <SingleMarketPnlChart data={spotPnlSeries} dataKey="spot" name="현물 누적수익" stroke="#ef4444" />
              ) : (
                <ChartEmptyState text="아직 청산 완료된 현물 거래가 없어요." />
              )}
            </ChartPanel>

            <ChartPanel title="선물 수익 추이" description="청산 완료된 선물 거래의 실현손익만 보여줘요.">
              {futuresPnlSeries.length ? (
                <SingleMarketPnlChart data={futuresPnlSeries} dataKey="futures" name="선물 누적수익" stroke="#2563eb" />
              ) : (
                <ChartEmptyState text="아직 청산 완료된 선물 거래가 없어요." />
              )}
            </ChartPanel>
          </div>

          {missingPricePositions.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              현재가를 입력하면 평가손익을 계산할 수 있어요. 현재가가 없는 종목: {missingPricePositions.map((position) => position.instrumentName).join(", ")}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1420px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["시장", "종목", "종목코드/티커", "보유수량/계약수", "평균진입가", "투자금액/명목금액", "현재가", "현재금액", "미실현손익", "평가수익률", "현재가 업데이트", "액션"].map((head, index) => <th key={head} className={`px-4 py-3 ${index >= 3 && index <= 10 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {!positions.length && <tr><td className="px-4 py-6 text-center text-sm font-semibold text-slate-500" colSpan={12}>아직 보유 중인 포지션이 없습니다. 신규 진입 거래를 남기면 이곳에 표시됩니다.</td></tr>}
              {positions.map((position) => (
                <tr key={position.id} className="border-t border-slate-100">
                  <td className="px-4 py-3"><MarketPill position={position} /></td>
                  <td className="px-4 py-3 font-bold">{position.instrumentName}</td>
                  <td className="px-4 py-3">{position.instrumentCode || "코드 없음"}</td>
                  <td className="px-4 py-3 text-right">{position.marketType === "spot" ? `${formatQuantity(position.quantity)}주` : `${formatQuantity(position.quantity)}계약`}</td>
                  <td className="px-4 py-3 text-right">{position.marketType === "spot" ? formatMoney(position.averageEntryPrice, position.currency) : `${position.averageEntryPrice.toLocaleString("ko-KR")}pt`}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(position.investmentAmount, position.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    {editingCode === position.instrumentCode ? (
                      <div className="flex justify-end gap-2">
                        <input className="input max-w-36 text-right" value={priceDraft} onChange={(event) => setPriceDraft(formatNumberInput(event.target.value))} placeholder="현재가" />
                        <button className="btn btn-primary" type="button" onClick={() => savePrice(position)}>저장</button>
                      </div>
                    ) : (
                      <button className="font-bold text-blue-600 underline-offset-2 hover:underline disabled:cursor-default disabled:no-underline" type="button" onClick={() => beginPriceEdit(position)} disabled={!admin}>
                        {position.currentPrice === undefined ? "현재가 입력 필요" : position.marketType === "spot" ? formatMoney(position.currentPrice, position.currency) : `${position.currentPrice.toLocaleString("ko-KR")}pt`}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{position.currentAmount === undefined ? "-" : formatMoney(position.currentAmount, position.currency)}</td>
                  <td className={`px-4 py-3 text-right font-black ${position.unrealizedPnl === undefined ? "text-slate-400" : pnlClass(position.unrealizedPnl)}`}>{position.unrealizedPnl === undefined ? "-" : formatMoney(position.unrealizedPnl, position.currency)}</td>
                  <td className="px-4 py-3 text-right">{position.returnRate === undefined ? "-" : <ReturnBadge value={position.returnRate} />}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{position.updatedAt ? new Date(position.updatedAt).toLocaleString("ko-KR") : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-72 flex-wrap gap-2">
                      <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={() => beginPriceEdit(position)} disabled={!admin}>현재가 수정</button>
                      <button className="btn btn-primary px-3 py-2 text-xs" type="button" onClick={() => beginExit(position)} disabled={!admin}>{position.marketType === "futures" ? "청산" : "매도"}</button>
                      <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={() => beginPositionEdit(position)} disabled={!admin}>종목정보 수정</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">거래 기록</h2>
          <p className="mt-1 text-sm text-slate-500">구글시트에서 가져온 선물 거래까지 포함해, 보유 중인 거래와 청산 완료 거래를 나눠서 확인합니다.</p>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 p-5">
          <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
            <FilterSelect label="기간" value={recordDateFilter} onChange={(value) => setRecordDateFilter(value as RecordDateFilter)}>
              <option value="all">전체</option>
              <option value="this_month">이번 달</option>
              <option value="last_month">지난 달</option>
              <option value="month">월별 선택</option>
              <option value="custom">직접 기간</option>
            </FilterSelect>
            {recordDateFilter === "month" && (
              <label>
                <div className="label mb-1.5">월 선택</div>
                <select className="input" value={recordMonth} onChange={(event) => setRecordMonth(event.target.value)}>
                  <option value="">월 선택</option>
                  {availableRecordMonths.map((month) => <option key={month} value={month}>{month.replace("-", ".")}</option>)}
                </select>
              </label>
            )}
            {recordDateFilter === "custom" && (
              <>
                <label><div className="label mb-1.5">시작일</div><input className="input" type="date" value={recordFromDate} onChange={(event) => setRecordFromDate(event.target.value)} /></label>
                <label><div className="label mb-1.5">종료일</div><input className="input" type="date" value={recordToDate} onChange={(event) => setRecordToDate(event.target.value)} /></label>
              </>
            )}
            <FilterSelect label="시장" value={recordMarket} onChange={(value) => setRecordMarket(value as MarketFilter)}>
              <option value="all">전체</option>
              <option value="spot">현물</option>
              <option value="futures">선물</option>
            </FilterSelect>
            <FilterSelect label="상태" value={recordStatus} onChange={(value) => setRecordStatus(value as RecordStatusFilter)}>
              <option value="all">전체</option>
              <option value="open">보유 중</option>
              <option value="partial_closed">부분매도/부분청산</option>
              <option value="closed">청산 완료</option>
            </FilterSelect>
            <FilterSelect label="손익" value={recordPnl} onChange={(value) => setRecordPnl(value as RecordPnlFilter)}>
              <option value="all">전체</option>
              <option value="profit">수익 거래</option>
              <option value="loss">손실 거래</option>
              <option value="zero">0원 거래</option>
            </FilterSelect>
            <FilterSelect label="포지션" value={recordSide} onChange={(value) => setRecordSide(value as RecordSideFilter)}>
              <option value="all">전체</option>
              <option value="buy">매수</option>
              <option value="sell">매도</option>
              <option value="long">롱</option>
              <option value="short">숏</option>
            </FilterSelect>
            <FilterSelect label="상품구분" value={recordAsset} onChange={(value) => setRecordAsset(value as RecordAssetFilter)}>
              <option value="all">전체</option>
              <option value="stock">주식</option>
              <option value="etf">ETF</option>
              <option value="futures">선물</option>
            </FilterSelect>
            <label className="lg:col-span-2 xl:col-span-2">
              <div className="label mb-1.5">종목 검색</div>
              <input className="input" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="종목명, 코드, 티커 검색" />
            </label>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="필터 내 거래수" value={`${recordSummary.count.toLocaleString("ko-KR")}건`} caption="현재 조건에 맞는 거래" />
          <KpiCard label="필터 내 실현손익" value={formatKRW(recordSummary.realizedPnl)} tone="pnl" caption="청산 완료 거래 기준" />
          <KpiCard label="수익 / 손실 거래" value={`${recordSummary.profitCount}건 / ${recordSummary.lossCount}건`} caption={`0원 거래 ${recordSummary.zeroCount}건`} />
          <KpiCard label="필터 내 승률" value={formatPercent(recordSummary.winRate)} caption="0원 거래 제외" />
        </div>

        <div className="divide-y divide-slate-100">
          {!recordGroups.length && (
            <div className="p-8 text-center">
              <div className="text-base font-black text-slate-800">조건에 맞는 거래기록이 없어요.</div>
              <p className="mt-2 text-sm font-semibold text-slate-500">필터를 변경하거나 거래내역을 추가해 주세요.</p>
            </div>
          )}
          {recordGroups.map((group) => {
            const collapsed = collapsedMonths.includes(group.month);
            return (
              <div key={group.month}>
                <button className="flex w-full flex-col gap-3 bg-white px-5 py-4 text-left hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between" type="button" onClick={() => toggleRecordMonth(group.month)}>
                  <div>
                    <div className="text-base font-black text-slate-950">{collapsed ? "▶" : "▼"} {formatMonthLabel(group.month)}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">월별로 거래를 접고 펼쳐서 볼 수 있어요.</div>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-5 lg:min-w-[720px]">
                    <MonthlyChip label="거래" value={`${group.summary.count}건`} />
                    <MonthlyChip label="실현손익" value={formatKRW(group.summary.realizedPnl)} className={pnlClass(group.summary.realizedPnl)} />
                    <MonthlyChip label="선물" value={formatKRW(group.summary.futuresPnl)} className={pnlClass(group.summary.futuresPnl)} />
                    <MonthlyChip label="현물" value={formatKRW(group.summary.spotPnl)} className={pnlClass(group.summary.spotPnl)} />
                    <MonthlyChip label="승률" value={formatPercent(group.summary.winRate)} />
                  </div>
                </button>
                {!collapsed && (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1120px] w-full text-sm">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                        <tr>
                          <SortableHead label="날짜" sortKey="date" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} />
                          <SortableHead label="시장" sortKey="marketType" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} />
                          <SortableHead label="종목" sortKey="instrumentName" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} />
                          <th className="px-4 py-3 text-left">포지션</th>
                          <SortableHead label="진입가" sortKey="entryPrice" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} alignRight />
                          <SortableHead label="청산가" sortKey="exitPrice" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} alignRight />
                          <th className="px-4 py-3 text-right">수량/계약수</th>
                          <SortableHead label="실현손익" sortKey="realizedPnl" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} alignRight />
                          <SortableHead label="상태" sortKey="status" currentKey={recordSortKey} direction={recordSortDirection} onSort={toggleRecordSort} />
                          <th className="px-4 py-3 text-left">메모</th>
                          <th className="px-4 py-3 text-left">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.trades.map((trade) => (
                          <tr key={trade.id} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/40 ${selected?.id === trade.id ? "bg-blue-50" : ""}`} onClick={() => setSelected(trade)}>
                            <td className="px-4 py-3 font-semibold text-slate-700">{trade.tradeDate}</td>
                            <td className="px-4 py-3"><MarketPill market={trade.marketType} /></td>
                            <td className="px-4 py-3"><div className="font-black text-slate-900">{trade.instrumentName || "-"}</div><div className="mt-0.5 text-xs font-semibold text-slate-400">{trade.instrumentCode || "코드 없음"}</div></td>
                            <td className="px-4 py-3"><PositionPill trade={trade} /></td>
                            <td className="px-4 py-3 text-right font-semibold">{formatEntryPrice(trade)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{trade.exitPrice === undefined ? "-" : formatExitPrice(trade)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatTradeVolume(trade)}</td>
                            <td className={`px-4 py-3 text-right font-black ${isRealizedPnlTrade(trade) ? pnlClass(trade.realizedPnl) : "text-slate-400"}`}>{isRealizedPnlTrade(trade) ? formatMoney(trade.realizedPnl, trade.currency) : "-"}</td>
                            <td className="px-4 py-3"><TradeStatusPill trade={trade} status={tradeStatuses.get(trade.id) ?? getFallbackTradeStatus(trade)} /></td>
                            <td className="max-w-[220px] px-4 py-3"><div className="truncate font-semibold text-slate-600">{trade.reviewMemo || trade.exitReason || trade.entryReason || "-"}</div></td>
                            <td className="px-4 py-3">
                              <div className="flex min-w-44 flex-wrap gap-2">
                                <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={(event) => { event.stopPropagation(); setSelected(trade); }}>상세보기</button>
                                {admin && <button className="btn btn-secondary px-3 py-2 text-xs text-blue-600" type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(trade); }}>삭제</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">거래 기록</h2>
          <p className="mt-1 text-sm text-slate-500">청산 완료 거래는 실현손익을, 보유 거래는 현재가 기준 미실현손익을 별도로 확인합니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1940px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["날짜", "시장", "상품구분", "종목", "종목코드/티커", "통화", "매수/매도", "진입가", "수량", "환율", "거래금액", "현재가", "현재금액", "미실현손익", "평가수익률", "청산가", "실현손익", "메모", "액션"].map((head, index) => (
                <th key={head} className={`px-4 py-3 ${index >= 7 && index <= 16 ? "text-right" : "text-left"}`}>{head}</th>
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
                    <td className="px-4 py-3">{trade.currency ?? "KRW"}</td>
                    <td className="px-4 py-3">{tradeSideLabel(trade)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(trade.entryPrice, trade.currency)}</td>
                    <td className="px-4 py-3 text-right">{trade.marketType === "spot" ? `${formatQuantity(trade.quantity ?? 0)}주` : `${formatQuantity(trade.contractCount ?? 0)}계약`}</td>
                    <td className="px-4 py-3 text-right">{trade.currency === "USD" ? (trade.exchangeRate ? trade.exchangeRate.toLocaleString("ko-KR") : "환율 입력 필요") : "-"}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(trade.tradeAmount, trade.currency)}</td>
                    <td className="px-4 py-3 text-right">{open ? position.currentPrice === undefined ? "현재가 입력 필요" : trade.marketType === "spot" ? formatMoney(position.currentPrice, position.currency) : `${position.currentPrice.toLocaleString("ko-KR")}pt` : "-"}</td>
                    <td className="px-4 py-3 text-right">{open && position.currentAmount !== undefined ? formatMoney(position.currentAmount, position.currency) : "-"}</td>
                    <td className={`px-4 py-3 text-right font-black ${open && position.unrealizedPnl !== undefined ? pnlClass(position.unrealizedPnl) : "text-slate-400"}`}>{open && position.unrealizedPnl !== undefined ? formatMoney(position.unrealizedPnl, position.currency) : "-"}</td>
                    <td className={`px-4 py-3 text-right font-black ${open && position.returnRate !== undefined ? pnlClass(position.returnRate) : "text-slate-400"}`}>{open && position.returnRate !== undefined ? formatPercent(position.returnRate) : "-"}</td>
                    <td className="px-4 py-3 text-right">{trade.exitPrice === undefined ? "-" : formatMoney(trade.exitPrice, trade.currency)}</td>
                    <td className={`px-4 py-3 text-right font-black ${pnlClass(trade.realizedPnl)}`}>{formatMoney(trade.realizedPnl, trade.currency)}</td>
                    <td className="px-4 py-3">{trade.reviewMemo || trade.entryReason || "-"}</td>
                    <td className="px-4 py-3">
                      {admin ? (
                        <button
                          className="btn btn-secondary px-3 py-2 text-xs text-blue-600"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(trade);
                          }}
                        >
                          삭제
                        </button>
                      ) : "-"}
                    </td>
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
            <Detail label="매수/매도" value={tradeSideLabel(selected)} />
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

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-6xl overflow-y-auto p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">구글시트 불러오기</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  구글시트 URL은 가져오기 때만 사용되고 저장되지 않아요. 첫 줄에는 컬럼명이 있어야 해요.
                  가져오기 완료 후에는 구글시트 공유 설정을 비공개로 바꿔도 됩니다.
                </p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => { setImportOpen(false); setSheetUrl(""); setImportRows([]); setImportError(""); }}>닫기</button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input className="input" value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0" />
              <button className="btn btn-primary" type="button" onClick={loadGoogleSheet} disabled={importing || !sheetUrl.trim()}>{importing ? "불러오는 중..." : "불러오기"}</button>
            </div>
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
              이미 가져온 거래내역은 앱에 저장되어 유지됩니다. 구글시트 URL, spreadsheetId, gid, exportUrl은 저장하지 않습니다.
            </div>
            {importError && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-700">{importError}</div>}

            {importRows.length > 0 && (
              <>
                <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-950">미리보기</h3>
                    <p className="mt-1 text-sm text-slate-500">중복 의심 또는 오류 행은 기본 제외됩니다. 필요한 값은 저장 전 직접 수정할 수 있어요.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <input type="checkbox" checked={hideImportAfterSave} onChange={(event) => setHideImportAfterSave(event.target.checked)} />
                    구글시트 불러오기 버튼 숨기기
                  </label>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1500px] w-full text-xs">
                    <thead className="bg-slate-50 font-black text-slate-500">
                      <tr>{["포함", "날짜", "종목", "포지션", "계약수", "진입가", "청산가", "수수료", "손익", "상태", "진입이유", "메모"].map((head) => <th key={head} className="px-3 py-2 text-left">{head}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-3 py-2"><input type="checkbox" checked={row.include} onChange={(event) => updateImportRow(row.id, "include", event.target.checked)} disabled={!shouldIncludeImportRow(row.status)} /></td>
                          <td className="px-3 py-2"><ImportInput value={row.date} onChange={(value) => updateImportRow(row.id, "date", value)} /></td>
                          <td className="px-3 py-2"><ImportInput value={row.instrumentName} onChange={(value) => updateImportRow(row.id, "instrumentName", value)} /></td>
                          <td className="px-3 py-2"><ImportInput value={row.position} onChange={(value) => updateImportRow(row.id, "position", value)} /></td>
                          <td className="px-3 py-2"><ImportInput value={row.contractCount} onChange={(value) => updateImportRow(row.id, "contractCount", value)} alignRight /></td>
                          <td className="px-3 py-2"><ImportInput value={row.entryPrice} onChange={(value) => updateImportRow(row.id, "entryPrice", value)} alignRight /></td>
                          <td className="px-3 py-2"><ImportInput value={row.exitPrice} onChange={(value) => updateImportRow(row.id, "exitPrice", value)} alignRight /></td>
                          <td className="px-3 py-2"><ImportInput value={row.fee} onChange={(value) => updateImportRow(row.id, "fee", value)} alignRight /></td>
                          <td className="px-3 py-2"><ImportInput value={row.realizedPnl} onChange={(value) => updateImportRow(row.id, "realizedPnl", value)} alignRight /></td>
                          <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                          <td className="px-3 py-2"><ImportInput value={row.entryReason} onChange={(value) => updateImportRow(row.id, "entryReason", value)} /></td>
                          <td className="px-3 py-2"><ImportInput value={row.memo} onChange={(value) => updateImportRow(row.id, "memo", value)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button className="btn btn-secondary" type="button" onClick={() => { setImportOpen(false); setSheetUrl(""); setImportRows([]); }}>취소</button>
                  <button className="btn btn-primary" type="button" onClick={saveImportedRows}>미리보기 항목 저장</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="text-lg font-black text-slate-950">거래 기록을 삭제할까요?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              삭제된 거래는 매매일지 목록, 실현손익, 누적수익, 승률, 보유 포지션, 그래프, 통계 계산에서 모두 제외됩니다.
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="font-black text-slate-900">{deleteTarget.instrumentName}</div>
              <div className="mt-1 font-semibold text-slate-500">{deleteTarget.tradeDate} · {deleteTarget.marketType === "futures" ? "선물" : "현물"} · {tradeSideLabel(deleteTarget)}</div>
              <div className={`mt-2 font-black ${pnlClass(deleteTarget.realizedPnl)}`}>실현손익 {formatMoney(deleteTarget.realizedPnl, deleteTarget.currency)}</div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="btn btn-primary" type="button" onClick={deleteTrade}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {editingPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="card w-full max-w-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">{editingPosition.instrumentName} 수정</h2>
                <p className="mt-1 text-sm text-slate-500">현재가는 평가손익 계산에만 사용돼요. 실제 매도가는 청산/매도 입력 시 따로 기록해 주세요.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setEditingPosition(null)}>닫기</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <EditInput label="종목코드/티커" value={positionDraft.code} onChange={(value) => setPositionDraft((current) => ({ ...current, code: value }))} />
              <EditInput label="거래소" value={positionDraft.exchange} onChange={(value) => setPositionDraft((current) => ({ ...current, exchange: value }))} />
              <label><div className="label mb-1.5">통화</div><select className="input" value={positionDraft.currency} onChange={(event) => setPositionDraft((current) => ({ ...current, currency: event.target.value as Currency }))}><option value="KRW">KRW</option><option value="USD">USD</option></select></label>
              <label className="md:col-span-2"><div className="label mb-1.5">메모</div><textarea className="input min-h-20" value={positionDraft.memo} onChange={(event) => setPositionDraft((current) => ({ ...current, memo: event.target.value }))} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setEditingPosition(null)}>취소</button>
              <button className="btn btn-primary" type="button" onClick={savePositionEdit}>저장</button>
            </div>
          </div>
        </div>
      )}

      {closingPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{closingPosition.marketType === "futures" ? "청산 기록" : "매도 기록"}</h2>
                <p className="mt-1 text-sm text-slate-500">현재가는 평가용입니다. 실제 매도/청산가는 이곳에 직접 입력해 실현손익으로 확정해 주세요.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setClosingPosition(null)}>닫기</button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Detail label="종목" value={closingPosition.instrumentName} />
              <Detail label="보유수량/계약수" value={closingPosition.marketType === "spot" ? `${formatQuantity(closingPosition.quantity)}주` : `${formatQuantity(closingPosition.quantity)}계약`} alignRight />
              <Detail label="평균진입가" value={closingPosition.marketType === "spot" ? formatMoney(closingPosition.averageEntryPrice, closingPosition.currency) : `${closingPosition.averageEntryPrice.toLocaleString("ko-KR")}pt`} alignRight />
              <Detail label="현재 평가손익" value={closingPosition.unrealizedPnl === undefined ? "현재가 입력 필요" : formatMoney(closingPosition.unrealizedPnl, closingPosition.currency)} className={closingPosition.unrealizedPnl === undefined ? "text-slate-500" : pnlClass(closingPosition.unrealizedPnl)} alignRight />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <EditInput label={closingPosition.marketType === "futures" ? "청산일" : "매도일"} type="date" value={exitDraft.date} onChange={(value) => setExitDraft((current) => ({ ...current, date: value }))} />
              <EditInput label={closingPosition.marketType === "futures" ? "청산계약수" : "매도수량"} value={exitDraft.quantity} onChange={(value) => setExitDraft((current) => ({ ...current, quantity: formatNumberInput(value) }))} />
              <EditInput label={closingPosition.marketType === "futures" ? "청산가" : "매도가"} value={exitDraft.price} onChange={(value) => setExitDraft((current) => ({ ...current, price: formatNumberInput(value) }))} />
              <EditInput label={closingPosition.marketType === "futures" ? "수수료 자동계산" : "수수료"} value={closingPosition.marketType === "futures" ? formatKRW(getExitPreview(closingPosition, exitDraft).fee) : exitDraft.fee} onChange={(value) => setExitDraft((current) => ({ ...current, fee: formatNumberInput(value) }))} disabled={closingPosition.marketType === "futures"} />
              <label className="md:col-span-2"><div className="label mb-1.5">청산이유</div><input className="input" value={exitDraft.exitReason} onChange={(event) => setExitDraft((current) => ({ ...current, exitReason: event.target.value }))} placeholder="왜 매도/청산했는지 남겨두세요" /></label>
              <label className="md:col-span-2"><div className="label mb-1.5">메모</div><textarea className="input min-h-20" value={exitDraft.memo} onChange={(event) => setExitDraft((current) => ({ ...current, memo: event.target.value }))} /></label>
            </div>

            <div className="mt-4">
              <div className="label mb-2">감정 태그</div>
              <div className="flex flex-wrap gap-2">
                {emotionOptions.map((tag) => (
                  <button
                    key={tag.value}
                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${exitDraft.emotionTags.includes(tag.value) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}
                    type="button"
                    onClick={() => toggleExitEmotion(tag.value)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            <ExitPreview position={closingPosition} draft={exitDraft} />
            {exitError && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-700">{exitError}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setClosingPosition(null)}>취소</button>
              <button className="btn btn-primary" type="button" onClick={saveExitTrade}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const chartColors = ["#2563eb", "#14b8a6", "#a855f7", "#6366f1", "#f97316", "#94a3b8"];

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label>
      <div className="label mb-1.5">{label}</div>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function MonthlyChip({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-bold text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-black ${className || "text-slate-800"}`}>{value}</div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  alignRight = false
}: {
  label: string;
  sortKey: RecordSortKey;
  currentKey: RecordSortKey;
  direction: SortDirection;
  onSort: (key: RecordSortKey) => void;
  alignRight?: boolean;
}) {
  const active = currentKey === sortKey;
  return (
    <th className={`px-4 py-3 ${alignRight ? "text-right" : "text-left"}`}>
      <button className={`font-black ${active ? "text-blue-600" : "text-slate-500"}`} type="button" onClick={() => onSort(sortKey)}>
        {label} {active ? direction === "asc" ? "↑" : "↓" : "↕"}
      </button>
    </th>
  );
}

function MarketPill({ market, position }: { market?: "spot" | "futures"; position?: PositionHoldingSummary }) {
  const type = position ? getPositionCategory(position) : market === "futures" ? "선물" : "국내ETF";
  const style: Record<string, string> = {
    국내주식: "bg-green-50 text-green-700",
    국내ETF: "bg-teal-50 text-teal-700",
    해외주식: "bg-purple-50 text-purple-700",
    해외ETF: "bg-indigo-50 text-indigo-700",
    선물: "bg-blue-50 text-blue-700"
  };
  const label = position ? type : market === "futures" ? "선물" : "현물";
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${style[type] ?? "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

function TradeStatusPill({ trade, status }: { trade: Trade; status: TradeDisplayStatus }) {
  const open = status === "open";
  const partial = status === "partial_closed";
  const label = open ? "보유 중" : partial ? trade.marketType === "futures" ? "부분청산" : "부분매도" : "청산 완료";
  const style = open ? "bg-orange-50 text-orange-700" : partial ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-black ${style}`}>
      {label}
    </span>
  );
}

function PositionPill({ trade }: { trade: Trade }) {
  const label = trade.marketType === "futures"
    ? trade.positionSide === "long" ? "롱" : "숏"
    : trade.positionSide === "long" ? "매수" : "매도";
  const style = trade.positionSide === "long" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-black ${style}`}>{label}</span>;
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

function parseNumber(value: string): number {
  return Number(value.replace(/,/g, "")) || 0;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function createExitDraft(position?: PositionHoldingSummary): ExitDraft {
  return {
    date: todayString(),
    quantity: position ? formatQuantity(position.quantity) : "",
    price: position?.currentPrice ? position.currentPrice.toLocaleString("ko-KR") : "",
    fee: "0",
    memo: "",
    exitReason: "",
    emotionTags: ["calm"]
  };
}

function getExitPreview(position: PositionHoldingSummary, draft: ExitDraft) {
  const quantity = parseNumber(draft.quantity);
  const exitPrice = parseNumber(draft.price);
  const manualFee = parseNumber(draft.fee);
  const multiplier = position.multiplier ?? 250000;
  const fee = position.marketType === "futures" && quantity && exitPrice
    ? calculateFuturesFee({ entryPrice: position.averageEntryPrice, exitPrice, contractCount: quantity, multiplier })
    : manualFee;
  const direction = position.positionSide === "long" ? 1 : -1;
  const realizedPnl = quantity && exitPrice
    ? position.marketType === "futures"
      ? position.positionSide === "long"
        ? (exitPrice - position.averageEntryPrice) * multiplier * quantity - fee
        : (position.averageEntryPrice - exitPrice) * multiplier * quantity - fee
      : (exitPrice - position.averageEntryPrice) * quantity * direction - fee
    : 0;
  const remainingQuantity = Math.max(position.quantity - quantity, 0);
  const remainingAmount = position.currentPrice === undefined
    ? undefined
    : position.marketType === "futures"
      ? position.currentPrice * multiplier * remainingQuantity
      : position.currentPrice * remainingQuantity;
  return { quantity, exitPrice, fee, realizedPnl, remainingQuantity, remainingAmount };
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 6 }).format(value);
}

function formatMoney(value: number, currency = "KRW"): string {
  if (currency === "USD") {
    return `$${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}`;
  }
  return formatKRW(value);
}

function positionAmount(position: PositionHoldingSummary): number {
  return position.currentAmount ?? position.investmentAmount;
}

function toPositionShare(positions: PositionHoldingSummary[]) {
  const rows = positions.map((position) => ({ name: position.instrumentName, value: Math.abs(positionAmount(position)), raw: positionAmount(position) })).sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5);
  const restValue = rest.reduce((sum, row) => sum + row.value, 0);
  const merged = rest.length ? [...top, { name: "기타", value: restValue, raw: restValue }] : top;
  return merged.map((row) => ({ ...row, percent: total ? (row.value / total) * 100 : 0 }));
}

function toSingleMarketPnlSeries(trades: Trade[], marketType: "spot" | "futures") {
  return buildCumulativePnlSeries(trades.filter((trade) => trade.marketType === marketType));
}

function getFallbackTradeStatus(trade: Trade): TradeDisplayStatus {
  if (isExitLikeTrade(trade)) return "closed";
  if (trade.tradeAction === "entry_exit" || trade.exitPrice !== undefined) return "closed";
  return "open";
}

function isOpenTrade(trade: Trade, statuses?: Map<string, TradeDisplayStatus>): boolean {
  return (statuses?.get(trade.id) ?? getFallbackTradeStatus(trade)) === "open";
}

function isExitLikeTrade(trade: Trade): boolean {
  return trade.tradeAction === "exit" || trade.tradeAction === "partial_exit" || trade.tradeAction === "full_exit";
}

function isRealizedPnlTrade(trade: Trade): boolean {
  if (trade.tradeAction === "entry") return trade.exitPrice !== undefined;
  if (trade.tradeAction === "entry_exit") return trade.exitPrice !== undefined || trade.realizedPnl !== 0;
  return isExitLikeTrade(trade);
}

function calculateTradeDisplayStatuses(trades: Trade[]): Map<string, TradeDisplayStatus> {
  const statuses = new Map<string, TradeDisplayStatus>();
  const entryLots = new Map<string, { id: string; original: number; remaining: number }[]>();
  const sorted = trades.slice().sort((a, b) => `${a.tradeDate}-${a.createdAt}`.localeCompare(`${b.tradeDate}-${b.createdAt}`));

  sorted.forEach((trade) => {
    const quantity = tradeQuantity(trade);
    const key = tradePositionKey(trade);

    if (trade.tradeAction === "entry" && trade.exitPrice === undefined) {
      const lots = entryLots.get(key) ?? [];
      lots.push({ id: trade.id, original: quantity, remaining: quantity });
      entryLots.set(key, lots);
      statuses.set(trade.id, "open");
      return;
    }

    if (trade.tradeAction === "entry_exit" || (trade.tradeAction === "entry" && trade.exitPrice !== undefined)) {
      statuses.set(trade.id, "closed");
      return;
    }

    if (isExitLikeTrade(trade)) {
      statuses.set(trade.id, "closed");
      let remainingExit = quantity;
      const lots = entryLots.get(key) ?? [];
      for (const lot of lots) {
        if (remainingExit <= 0) break;
        const consumed = Math.min(lot.remaining, remainingExit);
        lot.remaining -= consumed;
        remainingExit -= consumed;
      }
    }
  });

  entryLots.forEach((lots) => {
    lots.forEach((lot) => {
      if (lot.remaining <= 0.0000001) {
        statuses.set(lot.id, "closed");
      } else if (lot.remaining < lot.original - 0.0000001) {
        statuses.set(lot.id, "partial_closed");
      } else {
        statuses.set(lot.id, "open");
      }
    });
  });

  trades.forEach((trade) => {
    if (!statuses.has(trade.id)) statuses.set(trade.id, getFallbackTradeStatus(trade));
  });
  return statuses;
}

function tradeQuantity(trade: Trade): number {
  return trade.marketType === "futures" ? trade.contractCount ?? 0 : trade.quantity ?? 0;
}

function tradePositionKey(trade: Trade): string {
  const instrument = (trade.instrumentCode || trade.instrumentId || trade.instrumentName).toLowerCase();
  return `${trade.marketType}:${instrument}:${trade.positionSide}`;
}

function getAvailableMonths(trades: Trade[]): string[] {
  return Array.from(new Set(trades.map((trade) => trade.tradeDate.slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a));
}

function filterRecordTrades(trades: Trade[], filters: RecordFilters, statuses: Map<string, TradeDisplayStatus>): Trade[] {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const query = filters.search.trim().toLowerCase();

  return trades.filter((trade) => {
    if (filters.market !== "all" && trade.marketType !== filters.market) return false;
    const status = statuses.get(trade.id) ?? getFallbackTradeStatus(trade);
    if (filters.status !== "all" && filters.status !== status) return false;
    if (!pnlFilterMatches(trade, filters.pnl)) return false;
    if (!sideFilterMatches(trade, filters.side)) return false;
    if (!assetFilterMatches(trade, filters.asset)) return false;
    if (query && !`${trade.instrumentName} ${trade.instrumentCode}`.toLowerCase().includes(query)) return false;

    const tradeMonth = trade.tradeDate.slice(0, 7);
    if (filters.dateFilter === "this_month" && tradeMonth !== thisMonth) return false;
    if (filters.dateFilter === "last_month" && tradeMonth !== lastMonth) return false;
    if (filters.dateFilter === "month" && filters.month && tradeMonth !== filters.month) return false;
    if (filters.dateFilter === "custom") {
      if (filters.fromDate && trade.tradeDate < filters.fromDate) return false;
      if (filters.toDate && trade.tradeDate > filters.toDate) return false;
    }
    return true;
  });
}

function pnlFilterMatches(trade: Trade, filter: RecordPnlFilter): boolean {
  if (filter === "all") return true;
  if (!isRealizedPnlTrade(trade)) return filter === "zero";
  if (filter === "profit") return trade.realizedPnl > 0;
  if (filter === "loss") return trade.realizedPnl < 0;
  return trade.realizedPnl === 0;
}

function sideFilterMatches(trade: Trade, filter: RecordSideFilter): boolean {
  if (filter === "all") return true;
  if (filter === "buy" || filter === "long") return trade.positionSide === "long";
  return trade.positionSide === "short";
}

function assetFilterMatches(trade: Trade, filter: RecordAssetFilter): boolean {
  if (filter === "all") return true;
  if (filter === "futures") return trade.marketType === "futures" || trade.assetType === "index_futures" || trade.assetType === "stock_futures";
  return trade.assetType === filter;
}

function sortRecordTrades(trades: Trade[], key: RecordSortKey, direction: SortDirection): Trade[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return trades.slice().sort((a, b) => compareRecordTrade(a, b, key) * multiplier);
}

function compareRecordTrade(a: Trade, b: Trade, key: RecordSortKey): number {
  if (key === "date") return a.tradeDate.localeCompare(b.tradeDate);
  if (key === "instrumentName") return a.instrumentName.localeCompare(b.instrumentName);
  if (key === "marketType") return a.marketType.localeCompare(b.marketType);
  if (key === "entryPrice") return a.entryPrice - b.entryPrice;
  if (key === "exitPrice") return (a.exitPrice ?? 0) - (b.exitPrice ?? 0);
  if (key === "realizedPnl") return a.realizedPnl - b.realizedPnl;
  return getFallbackTradeStatus(a).localeCompare(getFallbackTradeStatus(b));
}

function summarizeRecordTrades(trades: Trade[]) {
  const closed = trades.filter(isRealizedPnlTrade);
  const realizedPnl = closed.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const spotPnl = closed.filter((trade) => trade.marketType === "spot").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const futuresPnl = closed.filter((trade) => trade.marketType === "futures").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  return {
    count: trades.length,
    realizedPnl,
    spotPnl,
    futuresPnl,
    profitCount: closed.filter((trade) => trade.realizedPnl > 0).length,
    lossCount: closed.filter((trade) => trade.realizedPnl < 0).length,
    zeroCount: closed.filter((trade) => trade.realizedPnl === 0).length,
    winRate: calculateWinRate(closed)
  };
}

function groupRecordTrades(trades: Trade[]) {
  const map = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const month = trade.tradeDate.slice(0, 7) || "unknown";
    map.set(month, [...(map.get(month) ?? []), trade]);
  });
  return Array.from(map.entries()).map(([month, monthTrades]) => ({
    month,
    trades: monthTrades,
    summary: summarizeRecordTrades(monthTrades)
  }));
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year}년 ${Number(monthNumber)}월`;
}

function formatTradeVolume(trade: Trade): string {
  return trade.marketType === "spot" ? `${formatQuantity(trade.quantity ?? 0)}주` : `${formatQuantity(trade.contractCount ?? 0)}계약`;
}

function formatEntryPrice(trade: Trade): string {
  return trade.marketType === "futures" ? `${trade.entryPrice.toLocaleString("ko-KR")}pt` : formatMoney(trade.entryPrice, trade.currency);
}

function formatExitPrice(trade: Trade): string {
  if (trade.exitPrice === undefined) return "-";
  return trade.marketType === "futures" ? `${trade.exitPrice.toLocaleString("ko-KR")}pt` : formatMoney(trade.exitPrice, trade.currency);
}

function toImportPreviewRow(row: Record<string, string>, index: number, existingTrades: Trade[]): ImportPreviewRow {
  const preview: ImportPreviewRow = {
    id: `import-row-${index}-${Date.now()}`,
    include: true,
    date: parseSheetDate(getSheetValue(row, ["날짜", "일자", "date"])),
    instrumentName: getSheetValue(row, ["종목", "종목명", "상품", "instrument"]),
    position: getSheetValue(row, ["포지션", "매수/매도", "방향", "position"]) || "매수",
    contractCount: normalizeNumberText(getSheetValue(row, ["계약수", "수량", "contractCount", "quantity"]) || "1"),
    entryPrice: normalizeNumberText(getSheetValue(row, ["진입가", "진입가격", "entryPrice"])),
    exitPrice: normalizeNumberText(getSheetValue(row, ["청산가", "청산가격", "exitPrice"])),
    fee: normalizeNumberText(getSheetValue(row, ["수수료", "fee"])),
    realizedPnl: normalizeNumberText(getSheetValue(row, ["손익", "실현손익", "pnl", "realizedPnl"])),
    entryReason: getSheetValue(row, ["진입이유", "진입 이유", "entryReason"]),
    exitReason: getSheetValue(row, ["청산이유", "청산 이유", "exitReason"]),
    memo: getSheetValue(row, ["메모", "복기", "reviewMemo"]),
    emotionTags: getSheetValue(row, ["감정태그", "감정 태그", "emotionTags"]),
    status: "정상"
  };
  const status = getImportStatus(preview, existingTrades);
  return { ...preview, status, include: shouldIncludeImportRow(status) };
}

function getSheetValue(row: Record<string, string>, names: string[]): string {
  const normalized = Object.entries(row).map(([key, value]) => [key.replace(/\s/g, "").toLowerCase(), value] as const);
  for (const name of names) {
    const found = normalized.find(([key]) => key === name.replace(/\s/g, "").toLowerCase());
    if (found) return found[1] ?? "";
  }
  return "";
}

function parseSheetDate(value: string): string {
  const text = value.trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function normalizeNumberText(value: string): string {
  const parsed = parseSheetNumber(value);
  return parsed === undefined ? "" : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 6 }).format(parsed);
}

function parseSheetNumber(value: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const negative = raw.includes("▼") || raw.startsWith("-");
  const positive = raw.includes("▲");
  const cleaned = raw.replace(/[▲▼,\s원₩ptPTS]/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return undefined;
  const number = Number(cleaned);
  if (Number.isNaN(number)) return undefined;
  if (negative) return -Math.abs(number);
  if (positive) return Math.abs(number);
  return number;
}

function getImportStatus(row: ImportPreviewRow, existingTrades: Trade[]): string {
  if (!row.date) return "날짜 오류";
  if (!parseNumber(row.entryPrice)) return "진입가 누락";
  if (isDuplicateImport(row, existingTrades)) return "중복 의심";
  if (!parseNumber(row.exitPrice)) return parseNumber(row.realizedPnl) ? "청산가 없음" : "보유 중";
  return "정상";
}

function shouldIncludeImportRow(status: string): boolean {
  return !["날짜 오류", "진입가 누락", "중복 의심"].includes(status);
}

function isDuplicateImport(row: ImportPreviewRow, existingTrades: Trade[]): boolean {
  const exitPrice = parseNumber(row.exitPrice);
  const realizedPnl = parseNumber(row.realizedPnl);
  const entryPrice = parseNumber(row.entryPrice);
  return existingTrades.some((trade) =>
    trade.tradeDate === row.date &&
    trade.instrumentName === row.instrumentName &&
    trade.positionSide === toPositionSide(row.position) &&
    Math.abs(trade.entryPrice - entryPrice) < 0.000001 &&
    Math.abs((trade.exitPrice ?? 0) - exitPrice) < 0.000001 &&
    Math.abs(trade.realizedPnl - realizedPnl) < 0.000001
  );
}

function toPositionSide(value: string): "long" | "short" {
  const text = value.toLowerCase();
  return text.includes("매도") || text.includes("short") || text.includes("숏") ? "short" : "long";
}

function toTradeFromImportRow(row: ImportPreviewRow, batchId: string, importedAt: string, index: number): Trade {
  const contractCount = parseNumber(row.contractCount) || 1;
  const entryPrice = parseNumber(row.entryPrice);
  const exitPrice = parseNumber(row.exitPrice);
  const fee = parseNumber(row.fee);
  const realizedPnl = exitPrice ? parseNumber(row.realizedPnl) : 0;
  const multiplier = 250000;
  const tradeAmount = entryPrice * multiplier * contractCount;
  const now = new Date().toISOString();
  const instrumentName = row.instrumentName.trim();
  return {
    id: `google-sheet-${Date.now()}-${index}`,
    tradeDate: row.date,
    marketType: "futures",
    assetType: "index_futures",
    instrumentId: `google-sheet-${instrumentName || "futures"}`,
    instrumentName,
    instrumentCode: instrumentName || "GOOGLE-SHEET-FUTURES",
    region: "domestic",
    currency: "KRW",
    exchange: "KRX",
    positionSide: toPositionSide(row.position),
    tradeAction: exitPrice ? "full_exit" : "entry",
    entryDate: row.date,
    entryPrice,
    exitDate: exitPrice ? row.date : undefined,
    exitPrice: exitPrice || undefined,
    contractCount,
    multiplier,
    tradeAmount,
    fee,
    realizedPnl,
    unrealizedPnl: 0,
    cumulativePnl: 0,
    marketCumulativePnl: 0,
    returnRate: exitPrice ? calculateReturnRate(realizedPnl, tradeAmount) : 0,
    entryReason: row.entryReason,
    exitReason: row.exitReason,
    emotionTags: parseEmotionTags(row.emotionTags),
    reviewMemo: row.memo,
    importSource: "google_sheet",
    importBatchId: batchId,
    importedAt,
    createdAt: now,
    updatedAt: now
  };
}

function parseEmotionTags(value: string): EmotionTag[] {
  const tags: { key: EmotionTag; labels: string[] }[] = [
    { key: "confidence", labels: ["자신감", "확신"] },
    { key: "anxiety", labels: ["불안"] },
    { key: "impatience", labels: ["조급"] },
    { key: "greed", labels: ["욕심"] },
    { key: "fear", labels: ["공포"] },
    { key: "calm", labels: ["평온", "차분"] },
    { key: "regret", labels: ["후회"] },
    { key: "conviction", labels: ["확신"] }
  ];
  const matched = tags.filter((tag) => tag.labels.some((label) => value.includes(label))).map((tag) => tag.key);
  return matched.length ? Array.from(new Set(matched)) : ["calm"];
}

function getPositionCategory(position: PositionHoldingSummary): string {
  if (position.marketType === "futures") return "선물";
  const overseas = position.currency === "USD" || position.region === "overseas";
  const etf = position.assetType === "etf" || position.instrumentName.toLowerCase().includes("etf");
  if (overseas && etf) return "해외ETF";
  if (overseas) return "해외주식";
  if (etf) return "국내ETF";
  return "국내주식";
}

function tradeSideLabel(trade: Trade): string {
  if (trade.tradeAction === "partial_exit") return trade.marketType === "futures" ? "부분청산" : "부분매도";
  if (trade.tradeAction === "full_exit" || trade.tradeAction === "exit") return trade.marketType === "futures" ? "청산" : "매도";
  if (trade.tradeAction === "entry_exit") return "진입+청산";
  return trade.positionSide === "long" ? "매수" : "매도";
}

function LegendList({ rows }: { rows: { name: string; raw: number; percent: number }[] }) {
  return <div className="space-y-2">{rows.map((row) => <div key={row.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"><div className="font-bold text-slate-700">{row.name}</div><div className="text-right font-black text-slate-900">{formatKRW(row.raw)} / {formatPercent(row.percent)}</div></div>)}</div>;
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-base font-black text-slate-950">{title}</h3><p className="mt-1 min-h-10 text-sm text-slate-500">{description}</p><div className="mt-4 flex-1">{children}</div></section>;
}

function SingleMarketPnlChart({ data, dataKey, name, stroke }: { data: ReturnType<typeof buildCumulativePnlSeries>; dataKey: "spot" | "futures"; name: string; stroke: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}만`} width={56} />
        <Tooltip formatter={(value, tooltipName) => [formatSignedKRW(Number(value)), tooltipName]} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={stroke} strokeWidth={3} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartEmptyState({ text = "매도/청산 기록을 추가하면 수익 추이를 볼 수 있어요." }: { text?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl bg-slate-50 p-5 text-center text-sm font-semibold leading-6 text-slate-500">
      {text}
    </div>
  );
}

function TopBar({ title, rows, positive = false }: { title: string; rows: PositionHoldingSummary[]; positive?: boolean }) {
  const data = rows.map((position) => ({ name: position.instrumentName, pnl: position.unrealizedPnl ?? 0, abs: Math.abs(position.unrealizedPnl ?? 0) }));
  const maxAbs = Math.max(...data.map((item) => item.abs), 1);
  const colorClass = positive ? "text-red-500" : "text-blue-500";
  const barClass = positive ? "bg-red-500" : "bg-blue-500";

  return (
    <div>
      <div className="mb-3 text-sm font-black text-slate-700">{title}</div>
      {data.length ? (
        <div className="space-y-3">
          {data.map((item) => {
            const width = Math.max((item.abs / maxAbs) * 100, 6);
            return (
              <div
                key={`${title}-${item.name}`}
                className="grid gap-2 rounded-xl px-1 py-1 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center"
                title={`${item.name} ${formatSignedKRW(item.pnl)}`}
              >
                <div className="min-w-0">
                  <div className="mb-1 break-keep text-xs font-bold leading-5 text-slate-600">{item.name}</div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-3 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
                <div className={`whitespace-nowrap text-right text-sm font-black tabular-nums ${colorClass}`}>
                  {formatSignedKRW(item.pnl)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">표시할 종목이 아직 없습니다.</div>
      )}
    </div>
  );
}

function ReturnBadge({ value }: { value: number }) {
  const level = Math.min(Math.abs(value), 20);
  const positive = value > 0;
  const bg = positive ? `rgba(239,68,68,${0.08 + level / 80})` : value < 0 ? `rgba(59,130,246,${0.08 + level / 80})` : "#f8fafc";
  return <span className={pnlClass(value)} style={{ backgroundColor: bg, borderRadius: 999, padding: "4px 8px", fontWeight: 900 }}>{formatPercent(value)}</span>;
}

function ExitPreview({ position, draft }: { position: PositionHoldingSummary; draft: ExitDraft }) {
  const preview = getExitPreview(position, draft);
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <KpiCard label="예상 실현손익" value={formatMoney(preview.realizedPnl, position.currency)} tone="pnl" caption={position.marketType === "futures" ? `수수료 ${formatKRW(preview.fee)} 반영` : preview.fee ? `수수료 ${formatKRW(preview.fee)} 반영` : "평균단가 기준"} />
      <KpiCard label={position.marketType === "futures" ? "청산 후 남은 계약" : "매도 후 남은 수량"} value={position.marketType === "futures" ? `${formatQuantity(preview.remainingQuantity)}계약` : `${formatQuantity(preview.remainingQuantity)}주`} caption="부분 매도/청산 후 보유분" />
      <KpiCard label="남은 평가금액" value={preview.remainingAmount === undefined ? "현재가 입력 필요" : formatMoney(preview.remainingAmount, position.currency)} caption="현재가 기준 평가용" />
    </div>
  );
}

function ImportInput({ value, onChange, alignRight = false }: { value: string; onChange: (value: string) => void; alignRight?: boolean }) {
  return <input className={`input h-9 min-w-28 text-xs ${alignRight ? "text-right" : ""}`} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "정상";
  const open = status === "보유 중";
  const className = ok
    ? "bg-green-50 text-green-700"
    : open
      ? "bg-blue-50 text-blue-700"
      : "bg-slate-100 text-slate-600";
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-black ${className}`}>{status}</span>;
}

function EditInput({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label><div className="label mb-1.5">{label}</div><input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></label>;
}
