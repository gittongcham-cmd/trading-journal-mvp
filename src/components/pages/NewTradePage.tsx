"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateFuturesFee, calculateRealizedPnl, calculateReturnRate, calculateTradeAmount, getActiveFuturesFeeRate } from "@/lib/calculations";
import { formatKRW, pnlClass } from "@/lib/format";
import { getAllInstruments } from "@/lib/search";
import { addTrade } from "@/lib/store";
import type { Currency, EmotionTag, Instrument, MarketType, PositionSide, Region, TradeAction } from "@/types/trading";
import { InstrumentCombobox } from "@/components/InstrumentCombobox";
import { isAdminMode } from "@/lib/auth";

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

type MarketMode = "domestic_spot" | "overseas_spot" | "futures";

export function NewTradePage() {
  const router = useRouter();
  const admin = isAdminMode();
  const allInstruments = getAllInstruments();
  const [marketMode, setMarketMode] = useState<MarketMode>("domestic_spot");
  const [marketType, setMarketType] = useState<MarketType>("spot");
  const [region, setRegion] = useState<Region>("domestic");
  const [instrument, setInstrument] = useState<Instrument>(allInstruments.find((item) => item.marketType === "spot" && item.region !== "overseas") ?? allInstruments[0]);
  const [tradeAction, setTradeAction] = useState<TradeAction>("entry_exit");
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [entryDate, setEntryDate] = useState("2026-07-03");
  const [entryPrice, setEntryPrice] = useState(0);
  const [exitDate, setExitDate] = useState("2026-07-03");
  const [exitPrice, setExitPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [contractCount, setContractCount] = useState(1);
  const [currency, setCurrency] = useState<Currency>(instrument.currency ?? "KRW");
  const [exchangeRate, setExchangeRate] = useState(0);
  const [targetPrice, setTargetPrice] = useState(0);
  const [entryReason, setEntryReason] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [reviewMemo, setReviewMemo] = useState("");
  const [emotionTags, setEmotionTags] = useState<EmotionTag[]>([]);

  const multiplier = marketType === "futures" ? instrument.multiplier ?? 250000 : undefined;
  const feeRate = instrument.feeRate ?? getActiveFuturesFeeRate();
  const fee = useMemo(
    () =>
      marketType === "futures"
        ? calculateFuturesFee({
            entryPrice,
            exitPrice: tradeAction === "entry" ? undefined : exitPrice,
            contractCount,
            multiplier,
            feeRate
          })
        : 0,
    [marketType, entryPrice, exitPrice, contractCount, multiplier, feeRate, tradeAction]
  );
  const tradeAmount = useMemo(
    () => calculateTradeAmount({ marketType, entryPrice, quantity, contractCount, multiplier }),
    [marketType, entryPrice, quantity, contractCount, multiplier]
  );
  const krwTradeAmount = currency === "USD" && exchangeRate ? tradeAmount * exchangeRate : tradeAmount;
  const realizedPnl = useMemo(
    () =>
      calculateRealizedPnl({
        marketType,
        positionSide,
        entryPrice,
        exitPrice: tradeAction === "entry" ? undefined : exitPrice,
        quantity,
        contractCount,
        multiplier,
        feeRate
      }),
    [marketType, positionSide, entryPrice, exitPrice, quantity, contractCount, multiplier, feeRate, tradeAction]
  );

  function handleMarketMode(nextMode: MarketMode) {
    setMarketMode(nextMode);
    const nextMarket: MarketType = nextMode === "futures" ? "futures" : "spot";
    const nextRegion: Region = nextMode === "overseas_spot" ? "overseas" : "domestic";
    setMarketType(nextMarket);
    setRegion(nextRegion);
    const nextInstrument = getAllInstruments().find((item) => item.marketType === nextMarket && (nextMarket === "futures" || (item.region ?? "domestic") === nextRegion)) ?? getAllInstruments()[0];
    setInstrument(nextInstrument);
    setCurrency(nextInstrument.currency ?? (nextRegion === "overseas" ? "USD" : "KRW"));
    setEntryPrice(0);
    setExitPrice(0);
  }

  function selectInstrument(nextInstrument: Instrument) {
    setInstrument(nextInstrument);
    setMarketType(nextInstrument.marketType);
    setRegion(nextInstrument.region ?? "domestic");
    setCurrency(nextInstrument.currency ?? "KRW");
    setMarketMode(nextInstrument.marketType === "futures" ? "futures" : (nextInstrument.region === "overseas" ? "overseas_spot" : "domestic_spot"));
  }

  function save() {
    if (!admin) return;
    const now = new Date().toISOString();
    addTrade({
      id: `trade-${Date.now()}`,
      tradeDate: entryDate,
      marketType,
      assetType: instrument.assetType,
      instrumentId: instrument.id,
      instrumentName: instrument.displayName,
      instrumentCode: instrument.code || instrument.displayName,
      region,
      currency,
      exchange: instrument.exchange,
      exchangeRate: currency === "USD" && exchangeRate ? exchangeRate : undefined,
      positionSide,
      tradeAction,
      entryDate,
      entryPrice,
      exitDate: tradeAction === "entry" ? undefined : exitDate,
      exitPrice: tradeAction === "entry" ? undefined : exitPrice,
      quantity: marketType === "spot" ? quantity : undefined,
      contractCount: marketType === "futures" ? contractCount : undefined,
      multiplier,
      tradeAmount,
      fee,
      realizedPnl,
      unrealizedPnl: 0,
      cumulativePnl: 0,
      marketCumulativePnl: 0,
      returnRate: calculateReturnRate(realizedPnl, tradeAmount),
      entryReason,
      exitReason,
      targetPrice: targetPrice || undefined,
      emotionTags,
      reviewMemo,
      createdAt: now,
      updatedAt: now
    });
    router.push("/trades");
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">거래 추가</h1>
          <p className="mt-1 text-sm text-slate-500">실제 주문이 아닌 기록, 계산, 복기 전용 입력 화면입니다.</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" href="/trades">취소</Link>
          {admin && <button className="btn btn-primary" type="button" onClick={save}>저장</button>}
        </div>
      </div>

      <form className="grid gap-4 xl:grid-cols-[1fr_1fr_360px]" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <Card title="기본 정보">
          <Field label="시장 선택">
            <div className="grid grid-cols-3 rounded-lg border border-slate-300 bg-white p-1">
              {[
                ["domestic_spot", "국내현물"],
                ["overseas_spot", "해외현물"],
                ["futures", "선물"]
              ].map(([value, label]) => (
                <button key={value} type="button" className={`rounded-md px-3 py-2 text-sm font-bold ${marketMode === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => handleMarketMode(value as MarketMode)}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="종목 검색">
            <InstrumentCombobox marketFilter={marketType} value={instrument} onSelect={selectInstrument} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="매수/매도">
              <select className="input" value={positionSide} onChange={(event) => setPositionSide(event.target.value as PositionSide)}>
                <option value="long">매수</option>
                <option value="short">매도</option>
              </select>
            </Field>
            <Field label="거래 방식">
              <select className="input" value={tradeAction} onChange={(event) => setTradeAction(event.target.value as TradeAction)}>
                <option value="entry">신규 진입</option>
                <option value="exit">청산</option>
                <option value="entry_exit">진입+청산</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card title="거래 정보">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="진입일"><input className="input" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></Field>
            <Field label="진입가"><NumberInput value={entryPrice} onChange={setEntryPrice} /></Field>
            <Field label={marketType === "spot" ? "수량" : "계약수"}>
              <NumberInput value={marketType === "spot" ? quantity : contractCount} onChange={marketType === "spot" ? setQuantity : setContractCount} />
            </Field>
            <Field label="통화">
              <select className="input" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                <option value="KRW">KRW</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            {currency === "USD" && (
              <Field label="환율">
                <NumberInput value={exchangeRate} onChange={setExchangeRate} />
              </Field>
            )}
            {tradeAction !== "entry" && (
              <>
                <Field label="청산일"><input className="input" type="date" value={exitDate} onChange={(event) => setExitDate(event.target.value)} /></Field>
                <Field label="청산가"><NumberInput value={exitPrice} onChange={setExitPrice} /></Field>
              </>
            )}
            <Field label="목표가"><NumberInput value={targetPrice} onChange={setTargetPrice} /></Field>
          </div>
          {marketType === "futures" && (
            <div className="mt-4 grid gap-3 rounded-xl bg-blue-50 p-4 md:grid-cols-4">
              <Info label="승수" value={`${(multiplier ?? 0).toLocaleString("ko-KR")}`} />
              <Info label="틱단위" value={`${instrument.tickSize ?? "-"}pt`} />
              <Info label="틱가치" value={formatKRW(instrument.tickValue ?? 0)} />
              <Info label="예상 수수료" value={formatKRW(fee)} />
            </div>
          )}
          {marketType === "futures" && (
            <p className="mt-3 text-xs font-semibold text-slate-500">키움 KOSPI200 선물 기본 수수료율 0.003% 기준으로 자동 계산됩니다.</p>
          )}
        </Card>

        <Card title="계산 결과">
          <div className="space-y-4">
            <Info label="종목" value={`${instrument.displayName} · ${instrument.code || "코드 없음"}`} />
            <Info label="시장/상품" value={`${region === "overseas" ? "해외" : "국내"} · ${marketType === "spot" ? "현물" : "선물"} · ${instrument.assetType}`} />
            <Info label="거래금액" value={currency === "USD" ? `$${tradeAmount.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}` : formatKRW(tradeAmount)} />
            {currency === "USD" && <Info label="원화 환산" value={exchangeRate ? formatKRW(krwTradeAmount) : "환율 입력 필요"} />}
            <Info label="예상 수수료" value={formatKRW(fee)} />
            <Info label="예상 손익" value={formatKRW(realizedPnl)} className={pnlClass(realizedPnl)} />
            <Info label="수익률" value={`${calculateReturnRate(realizedPnl, tradeAmount).toFixed(2)}%`} />
          </div>
        </Card>

        <div className="xl:col-span-3">
          <Card title="복기 메모">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="진입이유"><textarea className="input min-h-24" value={entryReason} onChange={(event) => setEntryReason(event.target.value)} /></Field>
              <Field label="청산이유"><textarea className="input min-h-24" value={exitReason} onChange={(event) => setExitReason(event.target.value)} /></Field>
              <Field label="감정 태그">
                <div className="flex flex-wrap gap-2">
                  {emotionOptions.map((option) => (
                    <label key={option.value} className={`rounded-full border px-3 py-2 text-sm font-bold ${emotionTags.includes(option.value) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={emotionTags.includes(option.value)}
                        onChange={() => setEmotionTags((current) => current.includes(option.value) ? current.filter((tag) => tag !== option.value) : [...current, option.value])}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="복기 메모"><textarea className="input min-h-24" value={reviewMemo} onChange={(event) => setReviewMemo(event.target.value)} /></Field>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card p-5"><h2 className="mb-4 text-lg font-black text-slate-950">{title}</h2><div className="space-y-4">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="label mb-1.5">{label}</div>{children}</label>;
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="input text-right" type="number" step="any" value={value || ""} onChange={(event) => onChange(Number(event.target.value))} />;
}

function Info({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div><div className="label">{label}</div><div className={`mt-1 text-base font-black text-slate-900 ${className}`}>{value}</div></div>;
}
