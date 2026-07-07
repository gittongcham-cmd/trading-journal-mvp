import { loadInstrumentPrices, saveInstrumentPrice } from "@/lib/store";
import type { InstrumentPrice, MarketType } from "@/types/trading";

export type QuoteSource = "manual" | "csv" | "external";

export interface QuoteInput {
  instrumentCode: string;
  instrumentName: string;
  marketType: MarketType;
  currentPrice: number;
  previousClose?: number;
  updatedAt?: string;
  source?: QuoteSource;
}

export interface QuoteProvider {
  source: QuoteSource;
  getCurrentPrice: (instrumentCode: string) => InstrumentPrice | undefined;
  getCurrentPrices: (instrumentCodes: string[]) => Record<string, InstrumentPrice>;
  updateManualPrice: (input: QuoteInput) => Record<string, InstrumentPrice>;
  importPricesFromCsv: (file: File) => Promise<Record<string, InstrumentPrice>>;
}

function byCode(prices: Record<string, InstrumentPrice>, instrumentCode: string): InstrumentPrice | undefined {
  return prices[instrumentCode] ?? Object.values(prices).find((price) => price.instrumentCode === instrumentCode);
}

export const manualQuoteProvider: QuoteProvider = {
  source: "manual",
  getCurrentPrice(instrumentCode) {
    return byCode(loadInstrumentPrices(), instrumentCode);
  },
  getCurrentPrices(instrumentCodes) {
    const prices = loadInstrumentPrices();
    return instrumentCodes.reduce<Record<string, InstrumentPrice>>((result, code) => {
      const quote = byCode(prices, code);
      if (quote) result[code] = quote;
      return result;
    }, {});
  },
  updateManualPrice(input) {
    const previousClose = input.previousClose;
    const changeAmount = previousClose === undefined ? undefined : input.currentPrice - previousClose;
    const changeRate = previousClose ? ((input.currentPrice - previousClose) / previousClose) * 100 : undefined;
    return saveInstrumentPrice({
      instrumentId: input.instrumentCode,
      instrumentCode: input.instrumentCode,
      instrumentName: input.instrumentName,
      marketType: input.marketType,
      currentPrice: input.currentPrice,
      previousClose,
      changeAmount,
      changeRate,
      source: input.source ?? "manual",
      updatedAt: input.updatedAt ?? new Date().toISOString()
    });
  },
  async importPricesFromCsv(file) {
    const text = await file.text();
    const [, ...rows] = text.trim().split(/\r?\n/);
    let prices = loadInstrumentPrices();
    rows.forEach((row) => {
      const [instrumentCode, instrumentName, currentPriceText, updatedAt] = row.split(",").map((cell) => cell.trim());
      const currentPrice = Number(currentPriceText);
      if (!instrumentCode || !currentPrice) return;
      prices = saveInstrumentPrice({
        instrumentId: instrumentCode,
        instrumentCode,
        instrumentName,
        currentPrice,
        source: "csv",
        updatedAt: updatedAt || new Date().toISOString()
      });
    });
    return prices;
  }
};

export const csvQuoteProvider: Pick<QuoteProvider, "source"> = { source: "csv" };
export const externalQuoteProvider: Pick<QuoteProvider, "source"> = { source: "external" };

export function getCurrentPrice(instrumentCode: string): InstrumentPrice | undefined {
  return manualQuoteProvider.getCurrentPrice(instrumentCode);
}

export function getCurrentPrices(instrumentCodes: string[]): Record<string, InstrumentPrice> {
  return manualQuoteProvider.getCurrentPrices(instrumentCodes);
}

export function updateManualPrice(input: QuoteInput): Record<string, InstrumentPrice> {
  return manualQuoteProvider.updateManualPrice(input);
}

export function importPricesFromCsv(file: File): Promise<Record<string, InstrumentPrice>> {
  return manualQuoteProvider.importPricesFromCsv(file);
}
