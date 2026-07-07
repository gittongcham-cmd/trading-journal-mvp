export type MarketType = "spot" | "futures";
export type MarketFilter = "all" | MarketType;
export type Region = "domestic" | "overseas";
export type Currency = "KRW" | "USD";
export type AssetType = "stock" | "etf" | "etn" | "index_futures" | "stock_futures";
export type PositionSide = "long" | "short";
export type TradeAction = "entry" | "exit" | "entry_exit";
export type EmotionTag = "confidence" | "anxiety" | "impatience" | "greed" | "fear" | "calm" | "regret" | "conviction";

export interface Instrument {
  id: string;
  marketType: MarketType;
  region?: Region;
  assetType: AssetType;
  name: string;
  code: string;
  displayName: string;
  exchange: string;
  currency?: Currency;
  memo?: string;
  sector?: string;
  initialConsonants: string;
  aliases: string[];
  multiplier?: number;
  tickSize?: number;
  tickValue?: number;
  feeRate?: number;
  contractMonth?: string;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  tradeDate: string;
  marketType: MarketType;
  assetType: AssetType;
  instrumentId: string;
  instrumentName: string;
  instrumentCode: string;
  region?: Region;
  currency?: Currency;
  exchange?: string;
  exchangeRate?: number;
  positionSide: PositionSide;
  tradeAction: TradeAction;
  entryDate?: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  quantity?: number;
  contractCount?: number;
  multiplier?: number;
  tradeAmount: number;
  fee: number;
  realizedPnl: number;
  unrealizedPnl: number;
  cumulativePnl: number;
  marketCumulativePnl: number;
  returnRate: number;
  entryReason: string;
  exitReason: string;
  targetPrice?: number;
  emotionTags: EmotionTag[];
  reviewMemo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRecord {
  id: string;
  recordDate: string;
  totalAsset: number;
  cash: number;
  spotEvaluationAmount: number;
  futuresMargin: number;
  futuresEvaluationAmount: number;
  unrealizedPnl: number;
  realizedPnl: number;
  deposit: number;
  withdrawal: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalanceItem {
  id: string;
  snapshotId: string;
  bankName: string;
  accountNumber?: string;
  accountName: string;
  amount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalanceSnapshot {
  id: string;
  recordDate: string;
  totalBalance: number;
  previousRecordChangeAmount?: number;
  previousRecordChangeRate?: number;
  previousMonthChangeAmount?: number;
  previousMonthChangeRate?: number;
  memo: string;
  items: AccountBalanceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InstrumentPrice {
  instrumentId: string;
  instrumentCode: string;
  instrumentName: string;
  marketType?: MarketType;
  currentPrice: number;
  previousClose?: number;
  changeAmount?: number;
  changeRate?: number;
  source?: "manual" | "csv" | "external";
  updatedAt: string;
}

export interface SpotHoldingSummary {
  instrumentId: string;
  instrumentName: string;
  instrumentCode: string;
  currency?: Currency;
  exchangeRate?: number;
  quantity: number;
  averageEntryPrice: number;
  investmentAmount: number;
  currentPrice?: number;
  currentAmount?: number;
  valuationPnl?: number;
  valuationReturnRate?: number;
}

export interface PositionHoldingSummary {
  id: string;
  marketType: MarketType;
  region?: Region;
  assetType?: AssetType;
  positionSide: PositionSide;
  instrumentId: string;
  instrumentName: string;
  instrumentCode: string;
  currency?: Currency;
  exchange?: string;
  exchangeRate?: number;
  quantity: number;
  averageEntryPrice: number;
  multiplier?: number;
  investmentAmount: number;
  nominalAmount?: number;
  currentPrice?: number;
  currentAmount?: number;
  unrealizedPnl?: number;
  returnRate?: number;
  updatedAt?: string;
}

export interface DateRange {
  from: string;
  to: string;
}
