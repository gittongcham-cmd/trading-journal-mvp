"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKRW } from "@/lib/format";
import { loadAccountRecords } from "@/lib/store";
import type { AccountRecord } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function AccountsPage() {
  const [records, setRecords] = useState<AccountRecord[]>([]);
  useEffect(() => setRecords(loadAccountRecords()), []);
  const latest = records[records.length - 1];
  const netDeposit = records.reduce((sum, record) => sum + record.deposit - record.withdrawal, 0);

  return (
    <div>
      <SectionHeader title="계좌기록" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="총자산" value={formatKRW(latest?.totalAsset ?? 0)} />
        <KpiCard label="예수금" value={formatKRW(latest?.cash ?? 0)} />
        <KpiCard label="현물 평가금액" value={formatKRW(latest?.spotEvaluationAmount ?? 0)} />
        <KpiCard label="선물 증거금" value={formatKRW(latest?.futuresMargin ?? 0)} />
        <KpiCard label="선물 미실현손익" value={formatKRW(latest?.unrealizedPnl ?? 0)} tone="pnl" />
        <KpiCard label="입출금 누계" value={formatKRW(netDeposit)} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Chart title="총자산 추이">
          <AreaChart data={records}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="recordDate" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} />
            <Area dataKey="totalAsset" stroke="#0f172a" fill="#dbeafe" />
          </AreaChart>
        </Chart>
        <Chart title="예수금 / 평가금액 구성">
          <BarChart data={records}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="recordDate" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} />
            <Bar dataKey="cash" stackId="a" fill="#64748b" name="예수금" /><Bar dataKey="spotEvaluationAmount" stackId="a" fill="#ef4444" name="현물" /><Bar dataKey="futuresMargin" stackId="a" fill="#2563eb" name="선물증거금" />
          </BarChart>
        </Chart>
        <Chart title="현물 / 선물 비중">
          <BarChart data={records.slice(-1)}>
            <XAxis dataKey="recordDate" /><YAxis hide /><Tooltip formatter={(value) => formatKRW(Number(value))} />
            <Bar dataKey="spotEvaluationAmount" fill="#ef4444" name="현물" /><Bar dataKey="futuresMargin" fill="#2563eb" name="선물" />
          </BarChart>
        </Chart>
      </div>
      <div className="card mt-5 overflow-x-auto">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{["날짜", "예수금", "현물 평가금액", "선물 증거금", "미실현손익", "총자산", "입금", "출금", "메모"].map((h) => <th className="px-3 py-2" key={h}>{h}</th>)}</tr></thead>
          <tbody>{records.map((record) => <tr className="border-t border-slate-100" key={record.id}><td className="px-3 py-2">{record.recordDate}</td><td className="px-3 py-2">{formatKRW(record.cash)}</td><td className="px-3 py-2">{formatKRW(record.spotEvaluationAmount)}</td><td className="px-3 py-2">{formatKRW(record.futuresMargin)}</td><td className="px-3 py-2">{formatKRW(record.unrealizedPnl)}</td><td className="px-3 py-2 font-bold">{formatKRW(record.totalAsset)}</td><td className="px-3 py-2">{formatKRW(record.deposit)}</td><td className="px-3 py-2">{formatKRW(record.withdrawal)}</td><td className="px-3 py-2">{record.memo}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return <div className="card p-4"><div className="mb-3 text-lg font-black">{title}</div><ResponsiveContainer width="100%" height={240}>{children}</ResponsiveContainer></div>;
}
