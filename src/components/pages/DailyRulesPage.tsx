"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDailyRuleCheck, getLocalDateKey, loadTradingRules, saveDailyRuleCheck } from "@/lib/store";
import type { DailyRuleCheck, TradingRule } from "@/types/trading";

export function DailyRulesPage() {
  const router = useRouter();
  const today = getLocalDateKey();
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [checkedRuleIds, setCheckedRuleIds] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [completedCheck, setCompletedCheck] = useState<DailyRuleCheck | undefined>();

  useEffect(() => {
    const loadedRules = loadTradingRules().filter((rule) => rule.isActive);
    const todayCheck = getDailyRuleCheck(today);
    setRules(loadedRules);
    setCompletedCheck(todayCheck?.isCompleted ? todayCheck : undefined);
    setCheckedRuleIds(todayCheck?.checkedRuleIds ?? []);
    setMemo(todayCheck?.memo ?? "");
  }, [today]);

  const allChecked = rules.length > 0 && rules.every((rule) => checkedRuleIds.includes(rule.id));
  const progress = useMemo(() => rules.length ? Math.round((checkedRuleIds.length / rules.length) * 100) : 0, [checkedRuleIds.length, rules.length]);

  function toggleRule(ruleId: string) {
    setCheckedRuleIds((current) => current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId]);
  }

  function completeCheck() {
    if (!allChecked) return;
    const now = new Date().toISOString();
    saveDailyRuleCheck({
      id: completedCheck?.id ?? `daily-check-${Date.now()}`,
      checkDate: today,
      checkedRuleIds,
      isCompleted: true,
      checkedAt: now,
      memo,
      createdAt: completedCheck?.createdAt ?? now,
      updatedAt: now
    });
    router.push("/");
  }

  if (!rules.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Header />
        <section className="card p-6 text-center">
          <h2 className="text-xl font-black text-slate-950">아직 등록된 매매 원칙이 없어요.</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">먼저 나만의 매매 원칙을 추가해 주세요.</p>
          <Link className="btn btn-primary mt-5" href="/trading-rules">매매 원칙 추가하기</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Header />

      {completedCheck && (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-lg font-black text-blue-900">오늘 굼톨매매 원칙 확인 완료</div>
          <div className="mt-2 text-sm font-semibold text-blue-700">
            체크 시간 {completedCheck.checkedAt ? new Date(completedCheck.checkedAt).toLocaleString("ko-KR") : "-"} · 체크한 원칙 {completedCheck.checkedRuleIds.length}개
          </div>
          {completedCheck.memo && <div className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700">{completedCheck.memo}</div>}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black">거래 전 30초만 멈추기</h2>
              <p className="mt-1 text-sm text-slate-500">오늘 지킬 매매 원칙을 확인하고 체크해 주세요. 조급한 매매를 줄이기 위한 나만의 안전장치예요.</p>
            </div>
            <Link className="btn btn-secondary" href="/trading-rules">매매 원칙 관리</Link>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-600">
              <span>체크 진행률</span>
              <span>{checkedRuleIds.length}/{rules.length} · {progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rules.map((rule) => (
            <label key={rule.id} className="flex cursor-pointer gap-3 p-4 hover:bg-slate-50">
              <input className="mt-1 h-5 w-5 accent-blue-600" type="checkbox" checked={checkedRuleIds.includes(rule.id)} onChange={() => toggleRule(rule.id)} />
              <div>
                <div className="font-black text-slate-900">{rule.title}</div>
                <div className="mt-1 text-xs font-bold text-blue-600">{rule.category}</div>
                {rule.description && <p className="mt-2 text-sm leading-6 text-slate-500">{rule.description}</p>}
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <label>
          <div className="label mb-2">오늘의 다짐 메모</div>
          <textarea className="input min-h-28" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="오늘은 어떤 원칙을 가장 조심할지 적어두세요." />
        </label>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="btn btn-secondary" type="button" onClick={() => setCheckedRuleIds(rules.map((rule) => rule.id))}>전체 체크</button>
          <button className="btn btn-primary" type="button" onClick={completeCheck} disabled={!allChecked}>체크 완료</button>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-black text-slate-950">굼톨매매 원칙</h1>
        <p className="mt-1 text-sm text-slate-500">굼톨굼톨 매매일지를 시작하기 전, 오늘 지킬 매매 원칙을 확인해요.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">오늘 날짜 {getLocalDateKey()}</div>
    </div>
  );
}
