"use client";

import { withCumulativePnl } from "@/lib/calculations";
import { withBalanceComparisons } from "@/lib/accountBalances";
import { getAccessPassword, isAdminMode } from "@/lib/auth";
import { loadCustomInstruments, saveCustomInstruments } from "@/lib/search";
import type { AccountBalanceSnapshot, AccountRecord, DailyRuleCheck, EmotionTag, Instrument, InstrumentPrice, Trade, TradingRule } from "@/types/trading";

const TRADES_KEY = "trading-journal-trades-v2-empty-start";
const ACCOUNTS_KEY = "trading-journal-accounts-v2-empty-start";
const BALANCE_SNAPSHOTS_KEY = "trading-journal-account-balance-snapshots-v1";
const INSTRUMENT_PRICES_KEY = "trading-journal-instrument-prices-v1";
const TRADING_RULES_KEY = "trading-journal-trading-rules-v1";
const DAILY_RULE_CHECKS_KEY = "trading-journal-daily-rule-checks-v1";

const defaultTradingRules: TradingRule[] = [
  "추격매수하지 않는다.",
  "진입 전 손실 가능 금액을 먼저 확인한다.",
  "이유 없는 진입은 하지 않는다.",
  "손실 중 감정적으로 물타기하지 않는다.",
  "선물은 계약수를 늘리기 전에 최악의 손실을 계산한다.",
  "조급하면 쉬어간다.",
  "복수매매하지 않는다.",
  "오늘 컨디션이 좋지 않으면 거래하지 않는다."
].map((title, index) => ({
  id: `default-rule-${index + 1}`,
  title,
  description: "",
  category: index === 4 ? "선물" : index === 2 ? "진입" : index === 3 ? "감정" : "공통",
  sortOrder: index + 1,
  isActive: true,
  createdAt: "2026-07-09T00:00:00.000Z",
  updatedAt: "2026-07-09T00:00:00.000Z"
}));

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
  void syncLocalStateToCloud();
}

export function addTrade(trade: Trade): Trade[] {
  const next = withCumulativePnl([...loadTrades(), trade]);
  saveTrades(next);
  return next;
}

export function loadInstrumentPrices(): Record<string, InstrumentPrice> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(INSTRUMENT_PRICES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, InstrumentPrice>;
  } catch {
    return {};
  }
}

export function saveInstrumentPrice(price: InstrumentPrice): Record<string, InstrumentPrice> {
  const current = loadInstrumentPrices();
  const next = { ...current, [price.instrumentCode]: price };
  window.localStorage.setItem(INSTRUMENT_PRICES_KEY, JSON.stringify(next));
  void syncLocalStateToCloud();
  return next;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadTradingRules(): TradingRule[] {
  if (typeof window === "undefined") return defaultTradingRules;
  const raw = window.localStorage.getItem(TRADING_RULES_KEY);
  if (!raw) return defaultTradingRules;
  try {
    return (JSON.parse(raw) as Partial<TradingRule>[])
      .map(normalizeTradingRule)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return defaultTradingRules;
  }
}

export function saveTradingRules(rules: TradingRule[]): void {
  window.localStorage.setItem(TRADING_RULES_KEY, JSON.stringify(rules.sort((a, b) => a.sortOrder - b.sortOrder)));
  void syncLocalStateToCloud();
}

export function loadDailyRuleChecks(): DailyRuleCheck[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(DAILY_RULE_CHECKS_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Partial<DailyRuleCheck>[]).map(normalizeDailyRuleCheck);
  } catch {
    return [];
  }
}

export function saveDailyRuleChecks(checks: DailyRuleCheck[]): void {
  window.localStorage.setItem(DAILY_RULE_CHECKS_KEY, JSON.stringify(checks));
  void syncLocalStateToCloud();
}

export function getDailyRuleCheck(date = getLocalDateKey()): DailyRuleCheck | undefined {
  return loadDailyRuleChecks().find((check) => check.checkDate === date);
}

export function saveDailyRuleCheck(check: DailyRuleCheck): DailyRuleCheck[] {
  const existing = loadDailyRuleChecks();
  const next = [...existing.filter((item) => item.checkDate !== check.checkDate), check].sort((a, b) => a.checkDate.localeCompare(b.checkDate));
  saveDailyRuleChecks(next);
  return next;
}

export function isDailyRulesCompletedToday(): boolean {
  const activeRules = loadTradingRules().filter((rule) => rule.isActive);
  if (!activeRules.length) return true;
  return Boolean(getDailyRuleCheck()?.isCompleted);
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
  void syncLocalStateToCloud();
}

export function addAccountBalanceSnapshot(snapshot: AccountBalanceSnapshot): AccountBalanceSnapshot[] {
  const existing = loadAccountBalanceSnapshots();
  const next = recalculateBalanceSnapshots([...existing, snapshot]);
  window.localStorage.setItem(BALANCE_SNAPSHOTS_KEY, JSON.stringify(next));
  void syncLocalStateToCloud();
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
    region: trade.region,
    currency: trade.currency ?? "KRW",
    exchange: trade.exchange,
    exchangeRate: trade.exchangeRate,
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

export async function hydrateLocalStateFromCloud(password: string): Promise<void> {
  const localTrades = loadTrades();
  const localBalanceSnapshots = loadAccountBalanceSnapshots();
  const localInstrumentPrices = loadInstrumentPrices();
  const localCustomInstruments = loadCustomInstruments();
  const localTradingRules = loadTradingRules();
  const localDailyRuleChecks = loadDailyRuleChecks();
  const response = await fetch("/api/app-data", {
    headers: { "x-app-password": password }
  });
  if (!response.ok) return;
  const data = (await response.json()) as {
    trades?: Trade[];
    accountBalanceSnapshots?: AccountBalanceSnapshot[];
    instrumentPrices?: Record<string, InstrumentPrice>;
    customInstruments?: Instrument[];
    tradingRules?: TradingRule[];
    dailyRuleChecks?: DailyRuleCheck[];
  };
  const cloudTrades = withCumulativePnl((data.trades ?? []).map(normalizeTrade));
  const cloudBalanceSnapshots = recalculateBalanceSnapshots((data.accountBalanceSnapshots ?? []).map(normalizeBalanceSnapshot));
  const cloudInstrumentPrices = data.instrumentPrices ?? {};
  const cloudCustomInstruments = data.customInstruments ?? [];
  const cloudTradingRules = (data.tradingRules ?? []).map(normalizeTradingRule).sort((a, b) => a.sortOrder - b.sortOrder);
  const cloudDailyRuleChecks = (data.dailyRuleChecks ?? []).map(normalizeDailyRuleCheck);
  const hasCloudPrices = Object.keys(cloudInstrumentPrices).length > 0;
  const shouldSeedCloud =
    isAdminMode() &&
    ((cloudTrades.length === 0 && localTrades.length > 0) ||
      (cloudBalanceSnapshots.length === 0 && localBalanceSnapshots.length > 0) ||
      (!hasCloudPrices && Object.keys(localInstrumentPrices).length > 0) ||
      (cloudCustomInstruments.length === 0 && localCustomInstruments.length > 0) ||
      (cloudTradingRules.length === 0 && localTradingRules.length > 0) ||
      (cloudDailyRuleChecks.length === 0 && localDailyRuleChecks.length > 0));

  window.localStorage.setItem(TRADES_KEY, JSON.stringify(cloudTrades.length ? cloudTrades : localTrades));
  window.localStorage.setItem(BALANCE_SNAPSHOTS_KEY, JSON.stringify(cloudBalanceSnapshots.length ? cloudBalanceSnapshots : localBalanceSnapshots));
  window.localStorage.setItem(INSTRUMENT_PRICES_KEY, JSON.stringify(hasCloudPrices ? cloudInstrumentPrices : localInstrumentPrices));
  saveCustomInstruments(cloudCustomInstruments.length ? cloudCustomInstruments : localCustomInstruments);
  window.localStorage.setItem(TRADING_RULES_KEY, JSON.stringify(cloudTradingRules.length ? cloudTradingRules : localTradingRules));
  window.localStorage.setItem(DAILY_RULE_CHECKS_KEY, JSON.stringify(cloudDailyRuleChecks.length ? cloudDailyRuleChecks : localDailyRuleChecks));

  if (shouldSeedCloud) {
    await syncLocalStateToCloud();
  }
}

export async function syncLocalStateToCloud(): Promise<boolean> {
  if (typeof window === "undefined" || !isAdminMode()) return false;
  const password = getAccessPassword();
  if (!password) return false;
  const response = await fetch("/api/app-data", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-app-password": password
    },
    body: JSON.stringify({
      trades: loadTrades(),
      accountBalanceSnapshots: loadAccountBalanceSnapshots(),
      instrumentPrices: loadInstrumentPrices(),
      customInstruments: loadCustomInstruments(),
      tradingRules: loadTradingRules(),
      dailyRuleChecks: loadDailyRuleChecks()
    })
  }).catch(() => null);
  return Boolean(response?.ok);
}

function normalizeTradingRule(rule: Partial<TradingRule>): TradingRule {
  const now = new Date().toISOString();
  return {
    id: rule.id ?? `rule-${Date.now()}`,
    title: rule.title ?? "",
    description: rule.description ?? "",
    category: rule.category ?? "공통",
    sortOrder: Number(rule.sortOrder ?? 0),
    isActive: rule.isActive ?? true,
    createdAt: rule.createdAt ?? now,
    updatedAt: rule.updatedAt ?? now
  };
}

function normalizeDailyRuleCheck(check: Partial<DailyRuleCheck>): DailyRuleCheck {
  const now = new Date().toISOString();
  return {
    id: check.id ?? `daily-check-${Date.now()}`,
    checkDate: check.checkDate ?? getLocalDateKey(),
    checkedRuleIds: check.checkedRuleIds ?? [],
    isCompleted: check.isCompleted ?? false,
    checkedAt: check.checkedAt,
    memo: check.memo ?? "",
    createdAt: check.createdAt ?? now,
    updatedAt: check.updatedAt ?? now
  };
}
