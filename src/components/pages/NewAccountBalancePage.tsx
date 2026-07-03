"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { changeRate, findPreviousMonthRecord, findPreviousRecord, sumNegative, sumPositive } from "@/lib/accountBalances";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { addAccountBalanceSnapshot, loadAccountBalanceSnapshots } from "@/lib/store";
import type { AccountBalanceItem } from "@/types/trading";

type DraftItem = Omit<AccountBalanceItem, "id" | "snapshotId" | "amount" | "createdAt" | "updatedAt"> & { amountText: string };

function emptyItem(): DraftItem {
  return { bankName: "", accountNumber: "", accountName: "", amountText: "", memo: "" };
}

export function NewAccountBalancePage() {
  const router = useRouter();
  const [recordDate, setRecordDate] = useState("2026-07-03");
  const [memo, setMemo] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { bankName: "국민은행", accountNumber: "", accountName: "생활비 통장", amountText: "", memo: "" }
  ]);
  const existing = useMemo(() => loadAccountBalanceSnapshots(), []);
  const parsedItems = items.map((item) => ({ ...item, amount: parseAmount(item.amountText) }));
  const totalBalance = parsedItems.reduce((sum, item) => sum + item.amount, 0);
  const positiveBalance = sumPositive(parsedItems.map(toTemporaryItem));
  const negativeBalance = sumNegative(parsedItems.map(toTemporaryItem));
  const previousRecord = findPreviousRecord(existing, recordDate);
  const previousMonth = findPreviousMonthRecord(existing, recordDate);
  const previousRecordChangeAmount = previousRecord ? totalBalance - previousRecord.totalBalance : undefined;
  const previousMonthChangeAmount = previousMonth ? totalBalance - previousMonth.totalBalance : undefined;

  function updateItem(index: number, field: keyof DraftItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "amountText" ? formatAmountInput(value) : value } : item));
  }

  function save() {
    const validItems = parsedItems.filter((item) => item.bankName.trim() && item.amountText.trim());
    if (!validItems.length) return;
    const now = new Date().toISOString();
    const snapshotId = `snapshot-${Date.now()}`;
    addAccountBalanceSnapshot({
      id: snapshotId,
      recordDate,
      totalBalance,
      previousRecordChangeAmount,
      previousRecordChangeRate: previousRecordChangeAmount === undefined ? undefined : changeRate(previousRecordChangeAmount, previousRecord?.totalBalance),
      previousMonthChangeAmount,
      previousMonthChangeRate: previousMonthChangeAmount === undefined ? undefined : changeRate(previousMonthChangeAmount, previousMonth?.totalBalance),
      memo,
      items: validItems.map((item, index) => ({
        id: `balance-item-${Date.now()}-${index}`,
        snapshotId,
        bankName: item.bankName.trim(),
        accountNumber: item.accountNumber?.trim() || undefined,
        accountName: item.accountName.trim(),
        amount: item.amount,
        memo: item.memo.trim(),
        createdAt: now,
        updatedAt: now
      })),
      createdAt: now,
      updatedAt: now
    });
    router.push("/accounts");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">계좌 잔고 등록</h1>
          <p className="mt-1 text-sm text-slate-500">매매일지와 분리해서 수기로 계좌별 잔고를 기록합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" href="/accounts">취소</Link>
          <button className="btn btn-primary" type="button" onClick={save}>저장</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-black">기본 정보</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label><div className="label mb-1.5">기록일</div><input className="input" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} /></label>
              <label><div className="label mb-1.5">전체 메모</div><input className="input" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="예: 월말 잔고 정리" /></label>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-lg font-black">계좌별 잔고 입력</h2>
              <button className="btn btn-secondary" type="button" onClick={() => setItems((current) => [...current, emptyItem()])}>+ 계좌 추가</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>{["은행명 / 증권사명", "계좌번호", "계좌 별칭", "금액", "메모", "삭제"].map((head, index) => <th key={head} className={`px-4 py-3 ${index === 3 ? "text-right" : "text-left"}`}>{head}</th>)}</tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const amount = parseAmount(item.amountText);
                    return (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="px-4 py-3"><input className="input" value={item.bankName} onChange={(event) => updateItem(index, "bankName", event.target.value)} placeholder="키움증권" required /></td>
                        <td className="px-4 py-3"><input className="input" value={item.accountNumber} onChange={(event) => updateItem(index, "accountNumber", event.target.value)} placeholder="선택 입력" /></td>
                        <td className="px-4 py-3"><input className="input" value={item.accountName} onChange={(event) => updateItem(index, "accountName", event.target.value)} placeholder="선물 계좌" /></td>
                        <td className="px-4 py-3"><input className={`input text-right font-bold ${amount < 0 ? "text-blue-500" : ""}`} value={item.amountText} onChange={(event) => updateItem(index, "amountText", event.target.value)} placeholder="-3,000,000" required /></td>
                        <td className="px-4 py-3"><input className="input" value={item.memo} onChange={(event) => updateItem(index, "memo", event.target.value)} placeholder="계좌별 메모" /></td>
                        <td className="px-4 py-3"><button className="btn btn-secondary" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="card h-fit p-5">
          <h2 className="text-lg font-black">자동 계산 요약</h2>
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <div className="text-xs font-bold text-blue-700">총 계좌 잔고</div>
            <div className={`mt-2 text-3xl font-black ${pnlClass(totalBalance)}`}>{formatKRW(totalBalance)}</div>
          </div>
          <div className="mt-4 grid gap-3">
            <Summary label="플러스 잔고 합계" value={formatKRW(positiveBalance)} />
            <Summary label="마이너스 잔고 합계" value={formatKRW(negativeBalance)} className="text-blue-500" />
            <Summary label="계좌 개수" value={`${items.length}개`} />
            <Summary label="직전 기록 대비 증감액" value={previousRecordChangeAmount === undefined ? "비교 데이터 없음" : formatKRW(previousRecordChangeAmount)} className={previousRecordChangeAmount === undefined ? "" : pnlClass(previousRecordChangeAmount)} />
            <Summary label="직전 기록 대비 증감률" value={previousRecordChangeAmount === undefined ? "비교 데이터 없음" : formatPercent(changeRate(previousRecordChangeAmount, previousRecord?.totalBalance) ?? 0)} className={previousRecordChangeAmount === undefined ? "" : pnlClass(previousRecordChangeAmount)} />
            <Summary label="전달 대비 증감액" value={previousMonthChangeAmount === undefined ? "비교 데이터 없음" : formatKRW(previousMonthChangeAmount)} className={previousMonthChangeAmount === undefined ? "" : pnlClass(previousMonthChangeAmount)} />
            <Summary label="전달 대비 증감률" value={previousMonthChangeAmount === undefined ? "비교 데이터 없음" : formatPercent(changeRate(previousMonthChangeAmount, previousMonth?.totalBalance) ?? 0)} className={previousMonthChangeAmount === undefined ? "" : pnlClass(previousMonthChangeAmount)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, "")) || 0;
}

function formatAmountInput(value: string): string {
  const cleaned = value.replace(/[^0-9-]/g, "");
  if (!cleaned || cleaned === "-") return cleaned;
  const negative = cleaned.startsWith("-");
  const numeric = cleaned.replace(/-/g, "");
  return `${negative ? "-" : ""}${Number(numeric).toLocaleString("ko-KR")}`;
}

function toTemporaryItem(item: DraftItem & { amount: number }): AccountBalanceItem {
  return { id: "", snapshotId: "", bankName: item.bankName, accountNumber: item.accountNumber, accountName: item.accountName, amount: item.amount, memo: item.memo, createdAt: "", updatedAt: "" };
}

function Summary({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className="rounded-xl border border-slate-200 p-3"><div className="label">{label}</div><div className={`mt-1 text-base font-black text-slate-900 ${className}`}>{value}</div></div>;
}
