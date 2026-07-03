import { instruments } from "@/data/seed";
import { getInitialConsonants, normalizeSearch } from "@/lib/choseong";
import type { Instrument, MarketFilter } from "@/types/trading";

const RECENT_KEY = "trading-journal-recent-instruments";

export function searchInstruments(query: string, marketFilter: MarketFilter = "all", recentIds: string[] = []): Instrument[] {
  const normalized = normalizeSearch(query);
  const filtered = instruments.filter((instrument) => marketFilter === "all" || instrument.marketType === marketFilter);

  const matches = filtered.filter((instrument) => {
    if (!normalized) return recentIds.includes(instrument.id) || ["inst-samsung", "inst-sk-hynix", "inst-hyundai-car", "inst-kodex200", "inst-tiger200", "inst-kospi200-fut"].includes(instrument.id);
    const haystack = [
      instrument.name,
      instrument.displayName,
      instrument.code,
      instrument.exchange,
      instrument.sector ?? "",
      instrument.initialConsonants,
      getInitialConsonants(instrument.name),
      ...instrument.aliases
    ]
      .map(normalizeSearch)
      .join("|");
    return haystack.includes(normalized);
  });

  return matches
    .sort((a, b) => {
      const aRecent = recentIds.includes(a.id) ? 0 : 1;
      const bRecent = recentIds.includes(b.id) ? 0 : 1;
      if (aRecent !== bRecent) return aRecent - bRecent;
      return a.displayName.localeCompare(b.displayName, "ko");
    })
    .slice(0, 50);
}

export function getRecentInstrumentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function rememberInstrument(id: string): void {
  if (typeof window === "undefined") return;
  const current = getRecentInstrumentIds().filter((recentId) => recentId !== id);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...current].slice(0, 5)));
}
