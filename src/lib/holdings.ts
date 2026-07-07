import type { InstrumentPrice, PositionHoldingSummary, PositionSide, SpotHoldingSummary, Trade } from "@/types/trading";

export function calculateSpotHoldings(trades: Trade[], prices: Record<string, InstrumentPrice>): SpotHoldingSummary[] {
  const byInstrument = new Map<string, {
    instrumentId: string;
    instrumentName: string;
    instrumentCode: string;
    buyQuantity: number;
    sellQuantity: number;
    buyAmount: number;
    currency?: "KRW" | "USD";
    exchangeRate?: number;
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
        buyAmount: 0,
        currency: trade.currency ?? "KRW",
        exchangeRate: trade.exchangeRate
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
      const quote = prices[item.instrumentCode] ?? prices[item.instrumentId];
      const currentPrice = quote?.currentPrice;
      const currentAmount = currentPrice === undefined ? undefined : currentPrice * quantity;
      const valuationPnl = currentAmount === undefined ? undefined : currentAmount - investmentAmount;
      const valuationReturnRate = valuationPnl === undefined || !investmentAmount ? undefined : (valuationPnl / investmentAmount) * 100;
      return {
        instrumentId: item.instrumentId,
        instrumentName: item.instrumentName,
        instrumentCode: item.instrumentCode,
        currency: item.currency,
        exchangeRate: item.exchangeRate,
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

export function calculateOpenPositions(trades: Trade[], prices: Record<string, InstrumentPrice>): PositionHoldingSummary[] {
  const spot = calculateSpotHoldings(trades, prices).map<PositionHoldingSummary>((holding) => ({
    id: `spot-${holding.instrumentCode}`,
    marketType: "spot",
    positionSide: "long",
    instrumentId: holding.instrumentId,
    instrumentName: holding.instrumentName,
    instrumentCode: holding.instrumentCode,
    quantity: holding.quantity,
    averageEntryPrice: holding.averageEntryPrice,
    investmentAmount: holding.investmentAmount,
    currentPrice: holding.currentPrice,
    currentAmount: holding.currentAmount,
    unrealizedPnl: holding.valuationPnl,
    returnRate: holding.valuationReturnRate,
    updatedAt: prices[holding.instrumentCode]?.updatedAt ?? prices[holding.instrumentId]?.updatedAt
  }));

  const futures = calculateFuturesHoldings(trades, prices);
  return [...spot, ...futures];
}

function calculateFuturesHoldings(trades: Trade[], prices: Record<string, InstrumentPrice>): PositionHoldingSummary[] {
  const byPosition = new Map<string, {
    instrumentId: string;
    instrumentName: string;
    instrumentCode: string;
    positionSide: PositionSide;
    entryContracts: number;
    exitContracts: number;
    entryAmount: number;
    multiplier: number;
    currency?: "KRW" | "USD";
    exchangeRate?: number;
  }>();

  trades
    .filter((trade) => trade.marketType === "futures")
    .forEach((trade) => {
      const side = trade.positionSide;
      const key = `${trade.instrumentCode}-${side}`;
      const current = byPosition.get(key) ?? {
        instrumentId: trade.instrumentId,
        instrumentName: trade.instrumentName,
        instrumentCode: trade.instrumentCode,
        positionSide: side,
        entryContracts: 0,
        exitContracts: 0,
        entryAmount: 0,
        multiplier: trade.multiplier ?? 250000,
        currency: trade.currency ?? "KRW",
        exchangeRate: trade.exchangeRate
      };
      const contracts = trade.contractCount ?? 0;

      if (trade.tradeAction === "entry") {
        current.entryContracts += contracts;
        current.entryAmount += trade.entryPrice * contracts;
      } else if (trade.tradeAction === "entry_exit") {
        current.entryContracts += contracts;
        current.exitContracts += contracts;
        current.entryAmount += trade.entryPrice * contracts;
      } else {
        current.exitContracts += contracts;
      }

      byPosition.set(key, current);
    });

  return Array.from(byPosition.values())
    .map((item) => {
      const quantity = item.entryContracts - item.exitContracts;
      const averageEntryPrice = item.entryContracts ? item.entryAmount / item.entryContracts : 0;
      const investmentAmount = averageEntryPrice * item.multiplier * quantity;
      const quote = prices[item.instrumentCode] ?? prices[item.instrumentId];
      const currentPrice = quote?.currentPrice;
      const nominalAmount = currentPrice === undefined ? undefined : currentPrice * item.multiplier * quantity;
      const currentAmount = nominalAmount;
      const unrealizedPnl = currentPrice === undefined
        ? undefined
        : item.positionSide === "long"
          ? (currentPrice - averageEntryPrice) * item.multiplier * quantity
          : (averageEntryPrice - currentPrice) * item.multiplier * quantity;
      const returnRate = unrealizedPnl === undefined || !investmentAmount ? undefined : (unrealizedPnl / investmentAmount) * 100;
      return {
        id: `futures-${item.instrumentCode}-${item.positionSide}`,
        marketType: "futures" as const,
        positionSide: item.positionSide,
        instrumentId: item.instrumentId,
        instrumentName: item.instrumentName,
        instrumentCode: item.instrumentCode,
        currency: item.currency,
        exchangeRate: item.exchangeRate,
        quantity,
        averageEntryPrice,
        multiplier: item.multiplier,
        investmentAmount,
        nominalAmount,
        currentPrice,
        currentAmount,
        unrealizedPnl,
        returnRate,
        updatedAt: quote?.updatedAt
      };
    })
    .filter((holding) => holding.quantity > 0);
}

export function summarizeOpenPositions(positions: PositionHoldingSummary[]) {
  const valued = positions.filter((position) => position.currentAmount !== undefined);
  const spotCurrentAmount = valued.filter((position) => position.marketType === "spot").reduce((sum, position) => sum + (position.currentAmount ?? 0), 0);
  const futuresCurrentAmount = valued.filter((position) => position.marketType === "futures").reduce((sum, position) => sum + (position.currentAmount ?? 0), 0);
  const totalInvestmentAmount = positions.filter((position) => position.marketType === "spot").reduce((sum, position) => sum + position.investmentAmount, 0);
  const unrealizedPnl = valued.reduce((sum, position) => sum + (position.unrealizedPnl ?? 0), 0);
  const valuationBase = valued.reduce((sum, position) => sum + position.investmentAmount, 0);
  return {
    totalInvestmentAmount,
    totalCurrentAmount: spotCurrentAmount,
    spotCurrentAmount,
    futuresCurrentAmount,
    unrealizedPnl,
    valuationReturnRate: valuationBase ? (unrealizedPnl / valuationBase) * 100 : 0,
    missingPriceCount: positions.length - valued.length
  };
}
