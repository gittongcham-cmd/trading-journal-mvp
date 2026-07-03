"use client";

import { useEffect, useMemo, useState } from "react";
import { getRecentInstrumentIds, rememberInstrument, searchInstruments } from "@/lib/search";
import type { Instrument, MarketFilter } from "@/types/trading";

export function InstrumentCombobox({
  marketFilter,
  value,
  onSelect
}: {
  marketFilter: MarketFilter;
  value?: Instrument;
  onSelect: (instrument: Instrument) => void;
}) {
  const [query, setQuery] = useState(value?.displayName ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(getRecentInstrumentIds());
  }, []);

  useEffect(() => {
    if (value) setQuery(value.displayName);
  }, [value]);

  const results = useMemo(() => searchInstruments(query, marketFilter, recentIds), [query, marketFilter, recentIds]);

  function choose(instrument: Instrument) {
    rememberInstrument(instrument.id);
    setRecentIds(getRecentInstrumentIds());
    setQuery(instrument.displayName);
    setOpen(false);
    onSelect(instrument);
  }

  return (
    <div className="relative">
      <input
        className="input"
        value={query}
        placeholder="종목명, 코드, 초성, 별칭 검색"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex]);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-soft">
          {results.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">검색 결과가 없습니다.</div>}
          {results.map((instrument, index) => {
            const recent = recentIds.includes(instrument.id);
            return (
              <button
                key={instrument.id}
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${
                  activeIndex === index ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(instrument)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{instrument.displayName}</span>
                  {recent && <span className="text-xs opacity-75">최근</span>}
                </div>
                <div className="mt-0.5 text-xs opacity-80">
                  {instrument.code} · {instrument.marketType === "spot" ? "현물" : "선물"} · {instrument.assetType}
                  {instrument.tickValue ? ` · 틱가치 ${instrument.tickValue.toLocaleString("ko-KR")}원` : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
