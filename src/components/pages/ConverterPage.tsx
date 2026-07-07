"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatPoint } from "@/lib/format";

export function ConverterPage() {
  const [baseKospi, setBaseKospi] = useState(8100);
  const [baseFutureIndex, setBaseFutureIndex] = useState(1300);
  const [targetKospi, setTargetKospi] = useState(8000);

  const result = useMemo(() => {
    const ratio = baseKospi ? baseFutureIndex / baseKospi : 0;
    const estimatedFutureIndex = targetKospi * ratio;
    return { ratio, estimatedFutureIndex };
  }, [baseKospi, baseFutureIndex, targetKospi]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-950">지수/선물 변환기</h1>
        <p className="mt-1 text-sm text-slate-500">
          기준 KOSPI와 기준 KOSPI200 선물지수의 비율로 목표 KOSPI를 선물지수로 단순 환산합니다.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="card p-5">
          <h2 className="text-lg font-black">입력값</h2>
          <p className="mt-1 text-sm text-slate-500">KOSPI200 현물값이나 Basis는 기본 계산에 사용하지 않습니다.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field label="기준 KOSPI" value={baseKospi} onChange={setBaseKospi} />
            <Field label="기준 KOSPI200 선물지수" value={baseFutureIndex} onChange={setBaseFutureIndex} />
            <Field label="변환할 KOSPI" value={targetKospi} onChange={setTargetKospi} />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-black">계산 결과</h2>
          <div className="mt-5 grid gap-3">
            <Result label="기준 비율" value={formatNumber(result.ratio, 7)} />
            <Result label="예상 KOSPI200 선물지수" value={formatPoint(result.estimatedFutureIndex)} highlight />
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
        이 값은 기준 KOSPI와 기준 KOSPI200 선물지수의 비율로 계산한 단순 환산값입니다. 실제 시장에서는 베이시스, 만기, 수급, 금리, 배당, 괴리율 등에 따라 달라질 수 있습니다.
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-black">테스트 기준</h2>
        <p className="mt-2 text-sm text-slate-600">
          기준 KOSPI 8,100pt, 기준 KOSPI200 선물지수 1,300pt, 변환할 KOSPI 8,000pt를 입력하면 예상 선물지수는{" "}
          <span className="font-black text-blue-700">{formatPoint(8000 * (1300 / 8100))}</span>입니다.
        </p>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <div className="label mb-1.5">{label}</div>
      <div className="relative">
        <input className="input pr-10 text-right" type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="absolute right-3 top-2 text-sm font-bold text-slate-400">pt</span>
      </div>
    </label>
  );
}

function Result({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 text-2xl font-black ${highlight ? "text-blue-700" : "text-slate-950"}`}>{value}</div>
    </div>
  );
}
