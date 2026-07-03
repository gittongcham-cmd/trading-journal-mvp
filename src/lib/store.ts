"use client";

import { withCumulativePnl } from "@/lib/calculations";
import { withBalanceComparisons } from "@/lib/accountBalances";
import type { AccountBalanceSnapshot, AccountRecord, EmotionTag, Trade } from "@/types/trading";

const TRADES_KEY = "trading-journal-trades-v2-empty-start";
const ACCOUNTS_KEY = "trading-journal-accounts-v2-empty-start";
const BALANCE_SNAPSHOTS_KEY = "trading-journal-account-balance-snapshots-v1";

export function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(TRADES_KEY);
  if (!raw) return [];
  try {
    return withCumulativePnl((JSON.parse(raw) as Partial<Trade>[]).map(normalizeTrade));
  } catch {
    return [];
  }
}

export function saveTrades(trades: Trade[]): void {
  window.localStorage.setItem(TRADES_KEY, JSON.stringify(withCumulativePnl(trades)));
}

export function addTrade(trade: Trade): Trade[] {
  const next = withCumulativePnl([...loadTrades(), trade]);
  saveTrades(next);
  return next;
}

export function loadAccountRecords(): AccountRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AccountRecord[];
  } catch {
    return [];
  }
}

export function loadAccountBalanceSnapshots(): AccountBalanceSnapshot[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(BALANCE_SNAPSHOTS_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as AccountBalanceSnapshot[])
      .map(normalizeBalanceSnapshot)
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate));
  } catch {
    return [];
  }
}

export function saveAccountBalanceSnapshots(snapshots: AccountBalanceSnapshot[]): void {
  window.localStorage.setItem(BALANCE_SNAPSHOTS_KEY, JSON.stringify(recalculateBalanceSnapshots(snapshots)));
}

export function addAccountBalanceSnapshot(snapshot: AccountBalanceSnapshot): AccountBalanceSnapshot[] {
  const existing = loadAccountBalanceSnapshots();
  const next = recalculateBalanceSnapshots([...existing, snapshot]);
  window.localStorage.setItem(BALANCE_SNAPSHOTS_KEY, JSON.stringify(next));
  return next;
}

export function updateAccountBalanceSnapshot(snapshot: AccountBalanceSnapshot): AccountBalanceSnapshot[] {
  const existing = loadAccountBalanceSnapshots();
  const next = recalculateBalanceSnapshots(existing.map((item) => item.id === snapshot.id ? snapshot : item));
  saveAccountBalanceSnapshots(next);
  return next;
}

export function deleteAccountBalanceSnapshot(id: string): AccountBalanceSnapshot[] {
  const next = recalculateBalanceSnapshots(loadAccountBalanceSnapshots().filter((snapshot) => snapshot.id !== id));
  saveAccountBalanceSnapshots(next);
  return next;
}

function recalculateBalanceSnapshots(snapshots: AccountBalanceSnapshot[]): AccountBalanceSnapshot[] {
  return snapshots
    .map((snapshot) => ({
      ...snapshot,
      totalBalance: snapshot.items.reduce((sum, item) => sum + item.amount, 0)
    }))
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate))
    .map((snapshot, index, sorted) => withBalanceComparisons(snapshot, sorted.slice(0, index)));
}

function normalizeTrade(trade: Partial<Trade>): Trade {
  const now = new Date().toISOString();
  const emotionTags = ((trade.emotionTags ?? []) as string[]).filter((tag) => tag !== "disciplined" && tag !== "rule_break") as EmotionTag[];
  return {
    id: trade.id ?? `trade-${Date.now()}`,
    tradeDate: trade.tradeDate ?? "2026-07-03",
    marketType: trade.marketType ?? "spot",
    assetType: trade.assetType ?? "stock",
    instrumentId: trade.instrumentId ?? "",
    instrumentName: trade.instrumentName ?? "",
    instrumentCode: trade.instrumentCode ?? "",
    positionSide: trade.positionSide ?? "long",
    tradeAction: trade.tradeAction ?? "entry_exit",
    entryDate: trade.entryDate,
    entryPrice: trade.entryPrice ?? 0,
    exitDate: trade.exitDate,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    contractCount: trade.contractCount,
    multiplier: trade.multiplier,
    tradeAmount: trade.tradeAmount ?? 0,
    fee: trade.fee ?? 0,
    realizedPnl: trade.realizedPnl ?? 0,
    unrealizedPnl: trade.unrealizedPnl ?? 0,
    cumulativePnl: trade.cumulativePnl ?? 0,
    marketCumulativePnl: trade.marketCumulativePnl ?? 0,
    returnRate: trade.returnRate ?? 0,
    entryReason: trade.entryReason ?? "",
    exitReason: trade.exitReason ?? "",
    targetPrice: trade.targetPrice,
    emotionTags: emotionTags.length ? emotionTags : ["calm"],
    reviewMemo: trade.reviewMemo ?? "",
    createdAt: trade.createdAt ?? now,
    updatedAt: trade.updatedAt ?? now
  };
}

function normalizeBalanceSnapshot(snapshot: Partial<AccountBalanceSnapshot>): AccountBalanceSnapshot {
  const now = new Date().toISOString();
  const id = snapshot.id ?? `snapshot-${Date.now()}`;
  const items = (snapshot.items ?? []).map((item) => ({
    id: item.id ?? `item-${Date.now()}`,
    snapshotId: item.snapshotId ?? id,
    bankName: item.bankName ?? "",
    accountNumber: item.accountNumber,
    accountName: item.accountName ?? "",
    amount: Number(item.amount ?? 0),
    memo: item.memo ?? "",
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now
  }));
  const totalBalance = snapshot.totalBalance ?? items.reduce((sum, item) => sum + item.amount, 0);
  return {
    id,
    recordDate: snapshot.recordDate ?? "2026-07-03",
    totalBalance,
    previousRecordChangeAmount: snapshot.previousRecordChangeAmount,
    previousRecordChangeRate: snapshot.previousRecordChangeRate,
    previousMonthChangeAmount: snapshot.previousMonthChangeAmount,
    previousMonthChangeRate: snapshot.previousMonthChangeRate,
    memo: snapshot.memo ?? "",
    items,
    createdAt: snapshot.createdAt ?? now,
    updatedAt: snapshot.updatedAt ?? now
  };
}
