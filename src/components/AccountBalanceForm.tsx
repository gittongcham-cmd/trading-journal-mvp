"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { changeRate, findPreviousMonthRecord, findPreviousRecord, sumNegative, sumPositive } from "@/lib/accountBalances";
import { isAdminMode } from "@/lib/auth";
import { formatKRW, formatPercent, pnlClass } from "@/lib/format";
import { loadAccountBalanceSnapshots } from "@/lib/store";
import type { AccountBalanceItem, AccountBalanceSnapshot } from "@/types/trading";

type DraftItem = Omit<AccountBalanceItem, "amount"> & { amountText: string };

interface AccountBalanceFormProps {
  mode: "create" | "edit";
  title: string;
  description: string;
  initialSnapshot?: AccountBalanceSnapshot;
  onSave: (snapshot: AccountBalanceSnapshot) => void;
}

function emptyItem(snapshotId = ""): DraftItem {
  const now = new Date().toISOString();
  return { id: `draft-${Date.now()}`, snapshotId, bankName: "", accountNumber: "", accountName: "", amountText: "", memo: "", createdAt: now, updatedAt: now };
}

export function AccountBalanceForm({ mode, title, description, initialSnapshot, onSave }: AccountBalanceFormProps) {
  const snapshotId = initialSnapshot?.id ?? `snapshot-${Date.now()}`;
  const admin = isAdminMode();
  const [recordDate, setRecordDate] = useState(initialSnapshot?.recordDate ?? "2026-07-04");
  const [memo, setMemo] = useState(initialSnapshot?.memo ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    initialSnapshot?.items.length
      ? initialSnapshot.items.map((item) => ({ ...item, amountText: formatAmountInput(String(item.amount)) }))
      : [{ ...emptyItem(snapshotId), bankName: "국민은행", accountName: "생활비 통장" }]
  );
  const existing = useMemo(
    () => loadAccountBalanceSnapshots().filter((snapshot) => snapshot.id !== initialSnapshot?.id),
    [initialSnapshot?.id]
  );
  const parsedItems = items.map((item) => ({ ...item, amount: parseAmount(item.amountText) }));
  const validItems = parsedItems.filter((item) => item.bankName.trim() && item.amountText.trim());
  const totalBalance = validItems.reduce((sum, item) => sum + item.amount, 0);
  const temporaryItems = validItems.map(toTemporaryItem);
  const positiveBalance = sumPositive(temporaryItems);
  const negativeBalance = sumNegative(temporaryItems);
  const previousRecord = findPreviousRecord(existing, recordDate);
  const previousMonth = findPreviousMonthRecord(existing, recordDate);
  const previousRecordChangeAmount = previousRecord ? totalBalance - previousRecord.totalBalance : undefined;
  const previousMonthChangeAmount = previousMonth ? totalBalance - previousMonth.totalBalance : undefined;

  function updateItem(index: number, field: keyof DraftItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "amountText" ? formatAmountInput(value) : value } : item));
  }

  function save() {
    if (!admin) return;
    if (!validItems.length) return;
    const now = new Date().toISOString();
    onSave({
      id: snapshotId,
      recordDate,
      totalBalance,
      previousRecordChangeAmount,
      previousRecordChangeRate: previousRecordChangeAmount === undefined ? undefined : changeRate(previousRecordChangeAmount, previousRecord?.totalBalance),
      previousMonthChangeAmount,
      previousMonthChangeRate: previousMonthChangeAmount === undefined ? undefined : changeRate(previousMonthChangeAmount, previousMonth?.totalBalance),
      memo,
      items: validItems.map((item, index) => ({
        id: item.id.startsWith("draft-") ? `balance-item-${Date.now()}-${index}` : item.id,
        snapshotId,
        bankName: item.bankName.trim(),
        accountNumber: item.accountNumber?.trim() || undefined,
        accountName: item.accountName.trim(),
        amount: item.amount,
        memo: item.memo.trim(),
        createdAt: item.createdAt || now,
        updatedAt: now
      })),
      createdAt: initialSnapshot?.createdAt ?? now,
      updatedAt: now
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" href="/accounts">취소</Link>
          {admin && <button className="btn btn-primary" type="button" onClick={save}>{mode === "edit" ? "수정 저장" : "저장"}</button>}
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
              {admin && <button className="btn btn-secondary" type="button" onClick={() => setItems((current) => [...current, emptyItem(snapshotId)])}>+ 계좌 추가</button>}
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
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3"><input className="input" value={item.bankName} onChange={(event) => updateItem(index, "bankName", event.target.value)} placeholder="키움증권" required disabled={!admin} /></td>
                        <td className="px-4 py-3"><input className="input" value={item.accountNumber ?? ""} onChange={(event) => updateItem(index, "accountNumber", event.target.value)} placeholder="선택 입력" disabled={!admin} /></td>
                        <td className="px-4 py-3"><input className="input" value={item.accountName} onChange={(event) => updateItem(index, "accountName", event.target.value)} placeholder="선물 계좌" disabled={!admin} /></td>
                        <td className="px-4 py-3"><input className={`input text-right font-bold ${amount < 0 ? "text-blue-500" : ""}`} value={item.amountText} onChange={(event) => updateItem(index, "amountText", event.target.value)} placeholder="-3,000,000" required disabled={!admin} /></td>
                        <td className="px-4 py-3"><input className="input" value={item.memo} onChange={(event) => updateItem(index, "memo", event.target.value)} placeholder="계좌별 메모" disabled={!admin} /></td>
                        <td className="px-4 py-3">{admin && <button className="btn btn-secondary" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button>}</td>
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
            <Summary label="계좌 개수" value={`${validItems.length}개`} />
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
  return { id: item.id, snapshotId: item.snapshotId, bankName: item.bankName, accountNumber: item.accountNumber, accountName: item.accountName, amount: item.amount, memo: item.memo, createdAt: item.createdAt, updatedAt: item.updatedAt };
}

function Summary({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className="rounded-xl border border-slate-200 p-3"><div className="label">{label}</div><div className={`mt-1 text-base font-black text-slate-900 ${className}`}>{value}</div></div>;
}
