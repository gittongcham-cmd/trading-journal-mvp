"use client";

import { useMemo, useState } from "react";
import { formatKRW, formatNumber, formatPoint, pnlClass } from "@/lib/format";
import type { PositionSide } from "@/types/trading";

type Direction = "kospi_to_future" | "future_to_kospi";

export function ConverterPage() {
  const [direction, setDirection] = useState<Direction>("kospi_to_future");
  const [baseKospi, setBaseKospi] = useState(8100);
  const [baseFutureIndex, setBaseFutureIndex] = useState(1300);
  const [targetKospi, setTargetKospi] = useState(8000);
  const [targetFutureIndex, setTargetFutureIndex] = useState(1300);
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [entryPrice, setEntryPrice] = useState(1300);
  const [contractCount, setContractCount] = useState(1);
  const [multiplier, setMultiplier] = useState(250000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [baseKospi200Spot, setBaseKospi200Spot] = useState(0);
  const [baseKospi200FutureForBasis, setBaseKospi200FutureForBasis] = useState(0);
  const [useBasis, setUseBasis] = useState(false);

  const result = useMemo(() => {
    const kospiToFutureRatio = baseKospi ? baseFutureIndex / baseKospi : 0;
    const basis = baseKospi200FutureForBasis - baseKospi200Spot;
    const simpleEstimatedFutureIndex = targetKospi * kospiToFutureRatio;
    const estimatedFutureIndex = useBasis ? simpleEstimatedFutureIndex + basis : simpleEstimatedFutureIndex;
    const estimatedKospi = kospiToFutureRatio ? targetFutureIndex / kospiToFutureRatio : 0;
    const pnlFutureIndex = direction === "kospi_to_future" ? estimatedFutureIndex : targetFutureIndex;
    const expectedPnl = positionSide === "long"
      ? (pnlFutureIndex - entryPrice) * multiplier * contractCount
      : (entryPrice - pnlFutureIndex) * multiplier * contractCount;

    return {
      kospiToFutureRatio,
      basis,
      estimatedFutureIndex,
      estimatedKospi,
      pnlFutureIndex,
      expectedPnl
    };
  }, [
    baseKospi,
    baseFutureIndex,
    targetKospi,
    targetFutureIndex,
    positionSide,
    entryPrice,
    contractCount,
    multiplier,
    direction,
    baseKospi200Spot,
    baseKospi200FutureForBasis,
    useBasis
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-950">지수/선물 변환기</h1>
        <p className="mt-1 text-sm text-slate-500">기준 KOSPI와 기준 KOSPI200 선물지수의 비율을 이용해 목표 지수를 환산합니다.</p>
      </div>

      <div className="flex rounded-lg border border-slate-300 bg-white p-1">
        {[
          ["kospi_to_future", "KOSPI → 선물지수"],
          ["future_to_kospi", "선물지수 → KOSPI"]
        ].map(([value, label]) => (
          <button
            key={value}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${direction === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            type="button"
            onClick={() => setDirection(value as Direction)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_420px]">
        <section className="card p-5">
          <h2 className="text-lg font-black">기준값 설정</h2>
          <div className="mt-5 space-y-4">
            <Field label="기준 KOSPI" value={baseKospi} onChange={setBaseKospi} suffix="pt" />
            <Field label="기준 KOSPI200 선물지수" value={baseFutureIndex} onChange={setBaseFutureIndex} suffix="pt" />
            <Readonly label="기준 비율" value={formatNumber(result.kospiToFutureRatio, 7)} />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-black">변환값 입력</h2>
          <div className="mt-5 space-y-4">
            {direction === "kospi_to_future" ? (
              <>
                <Field label="목표 KOSPI" value={targetKospi} onChange={setTargetKospi} suffix="pt" />
                <Readonly label="예상 KOSPI200 선물지수" value={formatPoint(result.estimatedFutureIndex)} className="text-blue-700" />
              </>
            ) : (
              <>
                <Field label="목표 KOSPI200 선물지수" value={targetFutureIndex} onChange={setTargetFutureIndex} suffix="pt" />
                <Readonly label="예상 KOSPI" value={formatPoint(result.estimatedKospi)} className="text-blue-700" />
              </>
            )}
          </div>
        </section>

        <aside className="card p-5">
          <h2 className="text-lg font-black">내 포지션 예상 손익</h2>
          <div className="mt-5 space-y-4">
            <label>
              <div className="label mb-1.5">포지션 방향</div>
              <select className="input" value={positionSide} onChange={(event) => setPositionSide(event.target.value as PositionSide)}>
                <option value="long">매수</option>
                <option value="short">매도</option>
              </select>
            </label>
            <Field label="진입가" value={entryPrice} onChange={setEntryPrice} suffix="pt" />
            <Field label="계약수" value={contractCount} onChange={setContractCount} />
            <Field label="승수" value={multiplier} onChange={setMultiplier} />
            <Readonly label="예상 선물지수" value={formatPoint(result.pnlFutureIndex)} />
            <Readonly label="예상 손익" value={formatKRW(result.expectedPnl)} className={pnlClass(result.expectedPnl)} />
          </div>
        </aside>
      </div>

      <section className="card overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left text-lg font-black"
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          <span>KOSPI200 현물 / Basis 반영</span>
          <span className="text-sm text-slate-500">{showAdvanced ? "접기" : "펼치기"}</span>
        </button>
        {showAdvanced && (
          <div className="border-t border-slate-100 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="기준 KOSPI200 현물" value={baseKospi200Spot} onChange={setBaseKospi200Spot} suffix="pt" />
              <Field label="기준 KOSPI200 선물" value={baseKospi200FutureForBasis} onChange={setBaseKospi200FutureForBasis} suffix="pt" />
              <Readonly label="Basis" value={formatPoint(result.basis)} />
              <label className="rounded-xl border border-slate-200 p-4">
                <div className="label">Basis 반영 여부</div>
                <div className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={useBasis} onChange={(event) => setUseBasis(event.target.checked)} />
                  예상 선물지수에 Basis 더하기
                </div>
              </label>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">기본 계산에는 KOSPI200 현물값을 사용하지 않습니다. 이 옵션을 켠 경우에만 KOSPI → 선물지수 결과에 Basis를 더합니다.</p>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
        이 값은 기준 KOSPI와 기준 KOSPI200 선물지수의 비율로 계산한 단순 환산값입니다. 실제 시장에서는 베이시스, 만기, 수급, 금리, 배당, 괴리율 등에 따라 달라질 수 있습니다.
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
        테스트 기준: 8100 / 1300 비율에서 KOSPI 8000은 {formatPoint(8000 * (1300 / 8100))}, 선물지수 1300은 {formatPoint(1300 / (1300 / 8100))}, 선물지수 1200은 {formatPoint(1200 / (1300 / 8100))}입니다.
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label>
      <div className="label mb-1.5">{label}</div>
      <div className="relative">
        <input className="input pr-10 text-right" type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <span className="absolute right-3 top-2 text-sm font-bold text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

function Readonly({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="label">{label}</div><div className={`mt-2 text-xl font-black text-slate-950 ${className}`}>{value}</div></div>;
}
