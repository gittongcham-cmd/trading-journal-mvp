"use client";

import { useEffect, useMemo, useState } from "react";
import { addCustomInstrument, getRecentInstrumentIds, rememberInstrument, searchInstruments } from "@/lib/search";
import { getInitialConsonants } from "@/lib/choseong";
import type { AssetType, Currency, Instrument, MarketFilter, MarketType, Region } from "@/types/trading";

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
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    region: "domestic" as Region,
    marketType: "spot" as MarketType,
    assetType: "stock" as AssetType,
    name: "",
    code: "",
    exchange: "KOSPI",
    currency: "KRW" as Currency,
    aliases: "",
    initialConsonants: "",
    memo: ""
  });

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

  function createInstrument() {
    const now = new Date().toISOString();
    const name = draft.name.trim() || query.trim();
    if (!name) return;
    const instrument: Instrument = {
      id: `custom-${Date.now()}`,
      marketType: draft.marketType,
      region: draft.region,
      assetType: draft.assetType,
      name,
      code: draft.code.trim(),
      displayName: name,
      exchange: draft.exchange.trim() || "기타",
      currency: draft.currency,
      sector: draft.memo,
      initialConsonants: draft.initialConsonants.trim() || getInitialConsonants(name),
      aliases: draft.aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
      memo: draft.memo,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    addCustomInstrument(instrument);
    choose(instrument);
    setAdding(false);
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
          {results.length === 0 && (
            <div className="space-y-2 px-3 py-3 text-sm text-slate-500">
              <div>검색 결과가 없습니다.</div>
              <button className="btn btn-primary w-full" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                setDraft((current) => ({ ...current, name: query, initialConsonants: getInitialConsonants(query) }));
                setAdding(true);
              }}>+ 새 종목 추가</button>
            </div>
          )}
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
                  {instrument.code || "코드 없음"} · {instrument.region === "overseas" ? "해외" : "국내"} · {instrument.marketType === "spot" ? "현물" : "선물"} · {instrument.assetType} · {instrument.currency ?? "KRW"}
                  {instrument.tickValue ? ` · 틱가치 ${instrument.tickValue.toLocaleString("ko-KR")}원` : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">새 종목 추가</h2>
              <button className="btn btn-secondary" type="button" onClick={() => setAdding(false)}>닫기</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="시장" value={draft.region} onChange={(value) => setDraft((current) => ({ ...current, region: value as Region, currency: value === "overseas" ? "USD" : "KRW", exchange: value === "overseas" ? "NASDAQ" : "KOSPI" }))} options={[["domestic", "국내"], ["overseas", "해외"]]} />
              <Select label="상품구분" value={draft.assetType} onChange={(value) => setDraft((current) => ({ ...current, assetType: value as AssetType, marketType: value.includes("futures") ? "futures" : "spot" }))} options={[["stock", "주식"], ["etf", "ETF"], ["etn", "ETN"], ["index_futures", "선물"]]} />
              <Input label="종목명" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value, initialConsonants: getInitialConsonants(value) }))} />
              <Input label="종목코드 또는 티커" value={draft.code} onChange={(value) => setDraft((current) => ({ ...current, code: value }))} placeholder="없으면 비워도 됩니다" />
              <Input label="거래소" value={draft.exchange} onChange={(value) => setDraft((current) => ({ ...current, exchange: value }))} />
              <Select label="통화" value={draft.currency} onChange={(value) => setDraft((current) => ({ ...current, currency: value as Currency }))} options={[["KRW", "KRW"], ["USD", "USD"]]} />
              <Input label="별칭" value={draft.aliases} onChange={(value) => setDraft((current) => ({ ...current, aliases: value }))} placeholder="쉼표로 구분" />
              <Input label="초성" value={draft.initialConsonants} onChange={(value) => setDraft((current) => ({ ...current, initialConsonants: value }))} />
              <label className="md:col-span-2"><div className="label mb-1.5">메모</div><textarea className="input min-h-20" value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} /></label>
            </div>
            <button className="btn btn-primary mt-4 w-full" type="button" onClick={createInstrument}>새 종목으로 저장하고 선택</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label><div className="label mb-1.5">{label}</div><input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label><div className="label mb-1.5">{label}</div><select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}
