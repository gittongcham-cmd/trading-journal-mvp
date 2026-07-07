"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { maskAccountNumber, sumNegative, sumPositive } from "@/lib/accountBalances";
import { isAdminMode } from "@/lib/auth";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { deleteAccountBalanceSnapshot, loadAccountBalanceSnapshots } from "@/lib/store";
import type { AccountBalanceSnapshot } from "@/types/trading";
import { KpiCard } from "@/components/ui/KpiCard";

export function AccountsPage() {
  const [records, setRecords] = useState<AccountBalanceSnapshot[]>([]);
  const [selected, setSelected] = useState<AccountBalanceSnapshot | null>(null);
  const admin = isAdminMode();

  useEffect(() => {
    const loaded = loadAccountBalanceSnapshots();
    setRecords(loaded);
    setSelected(loaded[loaded.length - 1] ?? null);
  }, []);

  const latest = records[records.length - 1];
  const positiveBalance = latest ? sumPositive(latest.items) : 0;
  const negativeBalance = latest ? sumNegative(latest.items) : 0;
  const weeklyData = useMemo(() => toWeeklyBalance(records), [records]);
  const donutData = useMemo(() => toTopAccountShare(latest), [latest]);

  function deleteRecord(id: string) {
    const ok = window.confirm("이 계좌 잔고 기록을 삭제할까요? 삭제 후에는 이후 기록의 증감률이 다시 계산됩니다.");
    if (!ok) return;
    const next = deleteAccountBalanceSnapshot(id);
    setRecords(next);
    setSelected(next[next.length - 1] ?? null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">계좌 잔고 기록</h1>
          <p className="mt-1 text-sm text-slate-500">매매일지 손익과 분리된 수기 계좌 잔고 기록입니다.</p>
        </div>
        {admin && <Link className="btn btn-primary" href="/account-records/new">+ 계좌 잔고 등록</Link>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="최신 총 잔고" value={formatKRW(latest?.totalBalance ?? 0)} tone="pnl" />
        <KpiCard label="플러스 잔고" value={formatKRW(positiveBalance)} />
        <KpiCard label="마이너스 잔고" value={formatKRW(negativeBalance)} tone="pnl" />
        <KpiCard label="직전 기록 대비" value={formatChange(latest?.previousRecordChangeAmount, latest?.previousRecordChangeRate)} tone="pnl" />
        <KpiCard label="전달 대비" value={formatChange(latest?.previousMonthChangeAmount, latest?.previousMonthChangeRate)} tone="pnl" />
        <KpiCard label="계좌 개수" value={`${latest?.items.length ?? 0}개`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Chart title="총 잔고 추이">
          <AreaChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" />
            <YAxis hide />
            <Tooltip formatter={(value) => formatKRW(Number(value))} />
            <Area dataKey="totalBalance" stroke="#2563eb" fill="#dbeafe" name="총 잔고" />
          </AreaChart>
        </Chart>
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 text-lg font-black">계좌별 비중</div>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92}>
              {donutData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.raw < 0 ? "#3b82f6" : ["#2563eb", "#14b8a6", "#f97316", "#64748b"][index % 4]} />)}
            </Pie>
            <Tooltip formatter={(_value, _name, item) => formatKRW(Number(item.payload.raw))} />
          </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {donutData.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <div className="font-bold text-slate-700">{item.name}</div>
                  <div className={`text-right font-black ${item.raw < 0 ? "text-blue-500" : "text-slate-900"}`}>
                    {formatKRW(item.raw)} / {formatPercent(item.percent)}
                  </div>
                </div>
              ))}
              {!donutData.length && <EmptyText text="계좌 잔고를 등록하면 계좌별 비중을 볼 수 있어요." />}
            </div>
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5 text-lg font-black">잔고 기록 목록</div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>{["기록일", "총 잔고", "플러스 잔고", "마이너스 잔고", "직전 기록 대비", "전달 대비", "계좌 개수", "메모", "액션"].map((head, index) => <th key={head} className={`px-4 py-3 ${index > 0 && index < 7 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {records.slice().reverse().map((record) => {
                const positive = sumPositive(record.items);
                const negative = sumNegative(record.items);
                return (
                  <tr key={record.id} className={`border-t border-slate-100 ${selected?.id === record.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-3">{record.recordDate}</td>
                    <td className={`px-4 py-3 text-right font-black ${pnlClass(record.totalBalance)}`}>{formatKRW(record.totalBalance)}</td>
                    <td className="px-4 py-3 text-right">{formatKRW(positive)}</td>
                    <td className="px-4 py-3 text-right text-blue-500">{formatKRW(negative)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${pnlClass(record.previousRecordChangeAmount ?? 0)}`}>{formatChange(record.previousRecordChangeAmount, record.previousRecordChangeRate)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${pnlClass(record.previousMonthChangeAmount ?? 0)}`}>{formatChange(record.previousMonthChangeAmount, record.previousMonthChangeRate)}</td>
                    <td className="px-4 py-3 text-right">{record.items.length}개</td>
                    <td className="px-4 py-3">{record.memo || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn btn-secondary" type="button" onClick={() => setSelected(record)}>상세보기</button>
                        {admin && <Link className="btn btn-secondary" href={`/account-records/${record.id}/edit`}>수정</Link>}
                        {admin && <button className="btn btn-secondary text-blue-600" type="button" onClick={() => deleteRecord(record.id)}>삭제</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-5 text-lg font-black">{selected.recordDate} 계좌별 잔고</div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>{["은행명 / 증권사명", "계좌 별칭", "계좌번호", "금액", "메모"].map((head, index) => <th key={head} className={`px-4 py-3 ${index === 3 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{item.bankName}</td>
                    <td className="px-4 py-3">{item.accountName || "-"}</td>
                    <td className="px-4 py-3">{maskAccountNumber(item.accountNumber)}</td>
                    <td className={`px-4 py-3 text-right font-black ${item.amount < 0 ? "text-blue-500" : "text-slate-900"}`}>{formatKRW(item.amount)}</td>
                    <td className="px-4 py-3">{item.memo || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function formatChange(amount?: number, rate?: number): string {
  if (amount === undefined || rate === undefined) return "비교 데이터 없음";
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatKRW(amount)} / ${sign}${formatPercent(rate)}`;
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return <section className="card p-5"><div className="mb-4 text-lg font-black">{title}</div><ResponsiveContainer width="100%" height={260}>{children}</ResponsiveContainer></section>;
}

function toWeeklyBalance(records: AccountBalanceSnapshot[]) {
  const byWeek = new Map<string, { label: string; totalBalance: number; recordDate: string }>();
  records.forEach((record) => {
    const date = new Date(record.recordDate);
    const month = date.getMonth() + 1;
    const week = Math.ceil(date.getDate() / 7);
    const key = `${date.getFullYear()}-${month}-${week}`;
    const label = `${month}월 ${week}주`;
    const current = byWeek.get(key);
    if (!current || record.recordDate >= current.recordDate) {
      byWeek.set(key, { label, totalBalance: record.totalBalance, recordDate: record.recordDate });
    }
  });
  return Array.from(byWeek.values());
}

function toTopAccountShare(snapshot?: AccountBalanceSnapshot) {
  if (!snapshot) return [];
  const items = snapshot.items
    .map((item) => ({ name: item.accountName || item.bankName, raw: item.amount, value: Math.abs(item.amount) }))
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const top = items.slice(0, 3);
  const rest = items.slice(3);
  const restValue = rest.reduce((sum, item) => sum + item.value, 0);
  const restRaw = rest.reduce((sum, item) => sum + item.raw, 0);
  const rows = rest.length ? [...top, { name: "기타", raw: restRaw, value: restValue }] : top;
  return rows.map((item) => ({ ...item, percent: total ? (item.value / total) * 100 : 0 }));
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div>;
}
