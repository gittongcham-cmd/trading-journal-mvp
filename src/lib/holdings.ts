import type { InstrumentPrice, SpotHoldingSummary, Trade } from "@/types/trading";

export function calculateSpotHoldings(trades: Trade[], prices: Record<string, InstrumentPrice>): SpotHoldingSummary[] {
  const byInstrument = new Map<string, {
    instrumentId: string;
    instrumentName: string;
    instrumentCode: string;
    buyQuantity: number;
    sellQuantity: number;
    buyAmount: number;
  }>();

  trades
    .filter((trade) => trade.marketType === "spot")
    .forEach((trade) => {
      const current = byInstrument.get(trade.instrumentId) ?? {
        instrumentId: trade.instrumentId,
        instrumentName: trade.instrumentName,
        instrumentCode: trade.instrumentCode,
        buyQuantity: 0,
        sellQuantity: 0,
        buyAmount: 0
      };
      const quantity = trade.quantity ?? 0;

      if (trade.tradeAction === "entry" && trade.positionSide === "long") {
        current.buyQuantity += quantity;
        current.buyAmount += trade.entryPrice * quantity;
      } else if (trade.tradeAction === "entry_exit" && trade.positionSide === "long") {
        current.buyQuantity += quantity;
        current.buyAmount += trade.entryPrice * quantity;
        current.sellQuantity += quantity;
      } else if (trade.tradeAction === "exit") {
        current.sellQuantity += quantity;
      } else {
        current.sellQuantity += quantity;
      }

      byInstrument.set(trade.instrumentId, current);
    });

  return Array.from(byInstrument.values())
    .map((item) => {
      const quantity = item.buyQuantity - item.sellQuantity;
      const averageEntryPrice = item.buyQuantity ? item.buyAmount / item.buyQuantity : 0;
      const investmentAmount = averageEntryPrice * quantity;
      const currentPrice = prices[item.instrumentId]?.currentPrice;
      const currentAmount = currentPrice === undefined ? undefined : currentPrice * quantity;
      const valuationPnl = currentAmount === undefined ? undefined : currentAmount - investmentAmount;
      const valuationReturnRate = valuationPnl === undefined || !investmentAmount ? undefined : (valuationPnl / investmentAmount) * 100;
      return {
        instrumentId: item.instrumentId,
        instrumentName: item.instrumentName,
        instrumentCode: item.instrumentCode,
        quantity,
        averageEntryPrice,
        investmentAmount,
        currentPrice,
        currentAmount,
        valuationPnl,
        valuationReturnRate
      };
    })
    .filter((holding) => holding.quantity > 0);
}

export function summarizeSpotHoldings(holdings: SpotHoldingSummary[]) {
  const totalInvestmentAmount = holdings.reduce((sum, holding) => sum + holding.investmentAmount, 0);
  const currentValuedHoldings = holdings.filter((holding) => holding.currentAmount !== undefined);
  const totalCurrentAmount = currentValuedHoldings.reduce((sum, holding) => sum + (holding.currentAmount ?? 0), 0);
  const valuationPnl = totalCurrentAmount - currentValuedHoldings.reduce((sum, holding) => sum + holding.investmentAmount, 0);
  const valuationBase = currentValuedHoldings.reduce((sum, holding) => sum + holding.investmentAmount, 0);
  const valuationReturnRate = valuationBase ? (valuationPnl / valuationBase) * 100 : 0;

  return {
    totalInvestmentAmount,
    totalCurrentAmount,
    valuationPnl,
    valuationReturnRate
  };
}
