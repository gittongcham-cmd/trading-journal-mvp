"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { instruments } from "@/data/seed";
import { calculateFuturesFee, calculateRealizedPnl, calculateReturnRate, calculateTradeAmount, getActiveFuturesFeeRate } from "@/lib/calculations";
import { formatKRW, pnlClass } from "@/lib/format";
import { addTrade } from "@/lib/store";
import type { EmotionTag, Instrument, MarketType, PositionSide, TradeAction } from "@/types/trading";
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

export function NewTradePage() {
  const router = useRouter();
  const admin = isAdminMode();
  const [marketType, setMarketType] = useState<MarketType>("spot");
  const [instrument, setInstrument] = useState<Instrument>(instruments.find((item) => item.marketType === "spot") ?? instruments[0]);
  const [tradeAction, setTradeAction] = useState<TradeAction>("entry_exit");
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [entryDate, setEntryDate] = useState("2026-07-03");
  const [entryPrice, setEntryPrice] = useState(0);
  const [exitDate, setExitDate] = useState("2026-07-03");
  const [exitPrice, setExitPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [contractCount, setContractCount] = useState(1);
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

  function handleMarket(nextMarket: MarketType) {
    setMarketType(nextMarket);
    setInstrument(instruments.find((item) => item.marketType === nextMarket) ?? instruments[0]);
    setEntryPrice(0);
    setExitPrice(0);
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
      instrumentCode: instrument.code,
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
            <div className="grid grid-cols-2 rounded-lg border border-slate-300 bg-white p-1">
              {[
                ["spot", "현물"],
                ["futures", "선물"]
              ].map(([value, label]) => (
                <button key={value} type="button" className={`rounded-md px-3 py-2 text-sm font-bold ${marketType === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => handleMarket(value as MarketType)}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="종목 검색">
            <InstrumentCombobox marketFilter={marketType} value={instrument} onSelect={setInstrument} />
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
            <Info label="종목" value={`${instrument.displayName} · ${instrument.code}`} />
            <Info label="시장/상품" value={`${marketType === "spot" ? "현물" : "선물"} · ${instrument.assetType}`} />
            <Info label="거래금액" value={formatKRW(tradeAmount)} />
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
