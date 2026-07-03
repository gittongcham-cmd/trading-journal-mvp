"use client";

import { useMemo, useState } from "react";
import { formatKRW, formatNumber, formatPoint, pnlClass } from "@/lib/format";
import type { PositionSide } from "@/types/trading";

type Direction = "kospi_to_future" | "future_to_kospi";

export function ConverterPage() {
  const [direction, setDirection] = useState<Direction>("kospi_to_future");
  const [currentKospi, setCurrentKospi] = useState(2664.63);
  const [currentKospi200, setCurrentKospi200] = useState(372.91);
  const [currentKospi200Future, setCurrentKospi200Future] = useState(373.2);
  const [targetKospi, setTargetKospi] = useState(2700);
  const [targetFuture, setTargetFuture] = useState(373.2);
  const [positionSide, setPositionSide] = useState<PositionSide>("long");
  const [entryPrice, setEntryPrice] = useState(373.2);
  const [contractCount, setContractCount] = useState(1);
  const [multiplier, setMultiplier] = useState(250000);

  const result = useMemo(() => {
    const currentRatio = currentKospi200 / currentKospi;
    const basis = currentKospi200Future - currentKospi200;
    const estimatedKospi200 = targetKospi * currentRatio;
    const estimatedFuture = estimatedKospi200 + basis;
    const estimatedKospi200FromFuture = targetFuture - basis;
    const estimatedKospiFromFuture = estimatedKospi200FromFuture / currentRatio;
    const expectedPnl = positionSide === "long"
      ? (estimatedFuture - entryPrice) * multiplier * contractCount
      : (entryPrice - estimatedFuture) * multiplier * contractCount;
    return {
      currentRatio,
      basis,
      estimatedKospi200,
      estimatedFuture,
      estimatedKospi200FromFuture,
      estimatedKospiFromFuture,
      expectedPnl
    };
  }, [currentKospi, currentKospi200, currentKospi200Future, targetKospi, targetFuture, positionSide, entryPrice, contractCount, multiplier]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-950">지수/선물 변환기</h1>
        <p className="mt-1 text-sm text-slate-500">KOSPI, KOSPI200, KOSPI200 선물의 현재 비율과 Basis로 목표 지수를 추정합니다.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section className="card p-5">
          <div className="mb-5 flex rounded-lg border border-slate-300 p-1">
            {[
              ["kospi_to_future", "KOSPI → 선물"],
              ["future_to_kospi", "선물 → KOSPI"]
            ].map(([value, label]) => (
              <button key={value} className={`flex-1 rounded-md px-3 py-2 text-sm font-bold ${direction === value ? "bg-blue-600 text-white" : "text-slate-600"}`} type="button" onClick={() => setDirection(value as Direction)}>{label}</button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="현재 KOSPI" value={currentKospi} onChange={setCurrentKospi} suffix="pt" />
            <Field label="현재 KOSPI200" value={currentKospi200} onChange={setCurrentKospi200} suffix="pt" />
            <Field label="현재 KOSPI200 선물" value={currentKospi200Future} onChange={setCurrentKospi200Future} suffix="pt" />
            <Readonly label="현재 비율" value={formatNumber(result.currentRatio, 6)} />
            <Readonly label="현재 Basis" value={formatPoint(result.basis)} />
            <Field label="목표 KOSPI" value={targetKospi} onChange={setTargetKospi} suffix="pt" />
            <Field label="목표 선물지수" value={targetFuture} onChange={setTargetFuture} suffix="pt" />
            <label>
              <div className="label mb-1.5">내 선물 포지션 방향</div>
              <select className="input" value={positionSide} onChange={(event) => setPositionSide(event.target.value as PositionSide)}>
                <option value="long">매수</option>
                <option value="short">매도</option>
              </select>
            </label>
            <Field label="진입가" value={entryPrice} onChange={setEntryPrice} suffix="pt" />
            <Field label="계약수" value={contractCount} onChange={setContractCount} />
            <Field label="승수" value={multiplier} onChange={setMultiplier} />
          </div>
        </section>
        <aside className="card p-5">
          <h2 className="text-lg font-black">계산 결과</h2>
          <div className="mt-5 space-y-4">
            <Readonly label="예상 KOSPI200" value={formatPoint(result.estimatedKospi200)} />
            <Readonly label="예상 선물지수" value={formatPoint(result.estimatedFuture)} className={direction === "kospi_to_future" ? "text-blue-700" : ""} />
            <Readonly label="예상 KOSPI200(선물 역산)" value={formatPoint(result.estimatedKospi200FromFuture)} />
            <Readonly label="예상 KOSPI" value={formatPoint(result.estimatedKospiFromFuture)} className={direction === "future_to_kospi" ? "text-blue-700" : ""} />
            <Readonly label="내 포지션 예상 손익" value={formatKRW(result.expectedPnl)} className={pnlClass(result.expectedPnl)} />
          </div>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
            이 값은 현재 KOSPI, KOSPI200, KOSPI200 선물의 비율과 Basis를 기준으로 계산한 추정값입니다. 실제 시장에서는 베이시스 변화, 만기, 수급, 금리, 배당 등에 따라 달라질 수 있습니다.
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
            테스트 확인: 목표 선물 373.20pt일 때 예상 KOSPI는 {formatPoint(result.estimatedKospiFromFuture)}, 목표 KOSPI 2700pt일 때 예상 선물은 {formatPoint(result.estimatedFuture)}입니다.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return <label><div className="label mb-1.5">{label}</div><div className="relative"><input className="input pr-10 text-right" type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix && <span className="absolute right-3 top-2 text-sm font-bold text-slate-400">{suffix}</span>}</div></label>;
}

function Readonly({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><div className="label">{label}</div><div className={`mt-2 text-xl font-black text-slate-950 ${className}`}>{value}</div></div>;
}
