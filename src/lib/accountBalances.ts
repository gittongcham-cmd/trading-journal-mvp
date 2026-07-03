import type { AccountBalanceItem, AccountBalanceSnapshot } from "@/types/trading";

export function sumPositive(items: AccountBalanceItem[]): number {
  return items.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
}

export function sumNegative(items: AccountBalanceItem[]): number {
  return items.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0);
}

export function maskAccountNumber(accountNumber?: string): string {
  if (!accountNumber) return "-";
  const parts = accountNumber.split("-");
  if (parts.length >= 3) {
    return `${parts[0]}-${"*".repeat(Math.max(parts[1].length, 4))}-${parts.slice(2).join("-")}`;
  }
  if (accountNumber.length <= 6) return accountNumber;
  return `${accountNumber.slice(0, 3)}-${"*".repeat(4)}-${accountNumber.slice(-4)}`;
}

export function findPreviousRecord(snapshots: AccountBalanceSnapshot[], recordDate: string): AccountBalanceSnapshot | undefined {
  return snapshots
    .filter((snapshot) => snapshot.recordDate < recordDate)
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0];
}

export function findPreviousMonthRecord(snapshots: AccountBalanceSnapshot[], recordDate: string): AccountBalanceSnapshot | undefined {
  const current = new Date(`${recordDate}T00:00:00`);
  const previousMonth = current.getMonth() === 0 ? 11 : current.getMonth() - 1;
  const previousYear = current.getMonth() === 0 ? current.getFullYear() - 1 : current.getFullYear();
  return snapshots
    .filter((snapshot) => {
      const date = new Date(`${snapshot.recordDate}T00:00:00`);
      return date.getFullYear() === previousYear && date.getMonth() === previousMonth;
    })
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))[0];
}

export function changeRate(changeAmount: number, base?: number): number | undefined {
  if (base === undefined) return undefined;
  if (base === 0) return 0;
  return (changeAmount / base) * 100;
}

export function withBalanceComparisons(snapshot: AccountBalanceSnapshot, existing: AccountBalanceSnapshot[]): AccountBalanceSnapshot {
  const previousRecord = findPreviousRecord(existing, snapshot.recordDate);
  const previousMonth = findPreviousMonthRecord(existing, snapshot.recordDate);
  const previousRecordChangeAmount = previousRecord ? snapshot.totalBalance - previousRecord.totalBalance : undefined;
  const previousMonthChangeAmount = previousMonth ? snapshot.totalBalance - previousMonth.totalBalance : undefined;
  return {
    ...snapshot,
    previousRecordChangeAmount,
    previousRecordChangeRate: previousRecordChangeAmount === undefined ? undefined : changeRate(previousRecordChangeAmount, previousRecord?.totalBalance),
    previousMonthChangeAmount,
    previousMonthChangeRate: previousMonthChangeAmount === undefined ? undefined : changeRate(previousMonthChangeAmount, previousMonth?.totalBalance)
  };
}
