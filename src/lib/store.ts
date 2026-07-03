"use client";

import { withCumulativePnl } from "@/lib/calculations";
import type { AccountRecord, EmotionTag, Trade } from "@/types/trading";

const TRADES_KEY = "trading-journal-trades-v2-empty-start";
const ACCOUNTS_KEY = "trading-journal-accounts-v2-empty-start";

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
