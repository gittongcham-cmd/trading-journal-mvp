import type { MarketType, PositionSide, Trade } from "@/types/trading";

interface PnlInput {
  marketType: MarketType;
  positionSide: PositionSide;
  entryPrice: number;
  exitPrice?: number;
  quantity?: number;
  contractCount?: number;
  multiplier?: number;
  feeRate?: number;
}

export const futuresFeeSettings = {
  futuresFeeRateDefault: 0.00003,
  futuresFeeRateDiscount: 0.0000025104,
  useDiscountFeeRate: false
};

export function getActiveFuturesFeeRate(): number {
  return futuresFeeSettings.useDiscountFeeRate
    ? futuresFeeSettings.futuresFeeRateDiscount
    : futuresFeeSettings.futuresFeeRateDefault;
}

export function calculateTradeAmount(input: Pick<PnlInput, "marketType" | "entryPrice" | "quantity" | "contractCount" | "multiplier">): number {
  if (input.marketType === "futures") {
    return input.entryPrice * (input.multiplier ?? 1) * (input.contractCount ?? 0);
  }
  return input.entryPrice * (input.quantity ?? 0);
}

export function calculateFuturesFee(input: Pick<PnlInput, "entryPrice" | "exitPrice" | "contractCount" | "multiplier" | "feeRate">): number {
  const contracts = input.contractCount ?? 0;
  const multiplier = input.multiplier ?? 250000;
  const feeRate = input.feeRate ?? getActiveFuturesFeeRate();
  const entryFee = input.entryPrice * multiplier * contracts * feeRate;
  const exitFee = input.exitPrice ? input.exitPrice * multiplier * contracts * feeRate : 0;
  return Math.round(entryFee + exitFee);
}

export function calculateRealizedPnl(input: PnlInput): number {
  if (!input.exitPrice) return 0;

  if (input.marketType === "spot") {
    const quantity = input.quantity ?? 0;
    const direction = input.positionSide === "long" ? 1 : -1;
    return (input.exitPrice - input.entryPrice) * quantity * direction;
  }

  const contracts = input.contractCount ?? 0;
  const multiplier = input.multiplier ?? 250000;
  const fee = calculateFuturesFee(input);
  if (input.positionSide === "long") {
    return (input.exitPrice - input.entryPrice) * multiplier * contracts - fee;
  }
  return (input.entryPrice - input.exitPrice) * multiplier * contracts - fee;
}

export function calculateReturnRate(realizedPnl: number, tradeAmount: number): number {
  if (!tradeAmount) return 0;
  return (realizedPnl / tradeAmount) * 100;
}

export function withCumulativePnl(trades: Trade[]): Trade[] {
  let cumulative = 0;
  let spotCumulative = 0;
  let futuresCumulative = 0;
  return trades
    .slice()
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    .map((trade) => {
      cumulative += trade.realizedPnl;
      if (trade.marketType === "spot") {
        spotCumulative += trade.realizedPnl;
      } else {
        futuresCumulative += trade.realizedPnl;
      }
      return {
        ...trade,
        cumulativePnl: cumulative,
        marketCumulativePnl: trade.marketType === "spot" ? spotCumulative : futuresCumulative
      };
    });
}

export function calculateWinRate(trades: Trade[]): number {
  const closed = trades.filter((trade) => trade.realizedPnl !== 0);
  if (!closed.length) return 0;
  return (closed.filter((trade) => trade.realizedPnl > 0).length / closed.length) * 100;
}
