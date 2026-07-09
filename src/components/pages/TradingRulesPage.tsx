"use client";

import { useEffect, useState } from "react";
import { isAdminMode } from "@/lib/auth";
import { loadTradingRules, saveTradingRules } from "@/lib/store";
import type { TradingRule, TradingRuleCategory } from "@/types/trading";

const categories: TradingRuleCategory[] = ["공통", "진입", "청산", "손절", "감정", "현물", "선물"];

type RuleDraft = {
  title: string;
  description: string;
  category: TradingRuleCategory;
};

const emptyDraft: RuleDraft = {
  title: "",
  description: "",
  category: "공통"
};

export function TradingRulesPage() {
  const admin = isAdminMode();
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRules(loadTradingRules());
  }, []);

  function persist(nextRules: TradingRule[], nextMessage = "저장되었습니다.") {
    const sorted = nextRules
      .map((rule, index) => ({ ...rule, sortOrder: index + 1, updatedAt: new Date().toISOString() }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    saveTradingRules(sorted);
    setRules(sorted);
    setMessage(nextMessage);
  }

  function resetForm() {
    setDraft(emptyDraft);
    setEditingId(null);
  }

  function saveRule() {
    if (!admin || !draft.title.trim()) return;
    const now = new Date().toISOString();
    if (editingId) {
      persist(rules.map((rule) => rule.id === editingId ? { ...rule, ...draft, title: draft.title.trim(), updatedAt: now } : rule));
      resetForm();
      return;
    }
    persist([
      ...rules,
      {
        id: `rule-${Date.now()}`,
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: draft.category,
        sortOrder: rules.length + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ]);
    resetForm();
  }

  function editRule(rule: TradingRule) {
    setEditingId(rule.id);
    setDraft({ title: rule.title, description: rule.description, category: rule.category });
    setMessage("");
  }

  function deleteRule(ruleId: string) {
    if (!admin) return;
    if (!window.confirm("이 매매 원칙을 삭제할까요?")) return;
    persist(rules.filter((rule) => rule.id !== ruleId), "삭제되었습니다.");
  }

  function toggleActive(ruleId: string) {
    if (!admin) return;
    persist(rules.map((rule) => rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule));
  }

  function moveRule(ruleId: string, direction: -1 | 1) {
    if (!admin) return;
    const index = rules.findIndex((rule) => rule.id === ruleId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= rules.length) return;
    const nextRules = [...rules];
    const [target] = nextRules.splice(index, 1);
    nextRules.splice(nextIndex, 0, target);
    persist(nextRules, "순서가 변경되었습니다.");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">매매 원칙 관리</h1>
          <p className="mt-1 text-sm text-slate-500">매일 체크할 굼톨매매 원칙을 추가하고 정리합니다.</p>
        </div>
        {message && <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{message}</div>}
      </div>

      {!admin && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          보기 전용에서는 매매 원칙을 수정할 수 없습니다. 관리자 비밀번호로 들어오면 추가/수정/삭제가 가능해요.
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-black">{editingId ? "원칙 수정" : "원칙 추가"}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <label>
            <div className="label mb-1.5">원칙 제목</div>
            <input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 추격매수하지 않는다." disabled={!admin} />
          </label>
          <label>
            <div className="label mb-1.5">카테고리</div>
            <select className="input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as TradingRuleCategory }))} disabled={!admin}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            <div className="label mb-1.5">설명</div>
            <textarea className="input min-h-24" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="왜 이 원칙을 지키는지 적어두세요." disabled={!admin} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {editingId && <button className="btn btn-secondary" type="button" onClick={resetForm}>취소</button>}
          <button className="btn btn-primary" type="button" onClick={saveRule} disabled={!admin || !draft.title.trim()}>{editingId ? "수정 저장" : "원칙 추가"}</button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">원칙 목록</h2>
          <p className="mt-1 text-sm text-slate-500">활성화된 원칙만 굼톨매매 원칙 체크 페이지에 표시됩니다.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {!rules.length && (
            <div className="p-6 text-center text-sm font-semibold text-slate-500">아직 등록된 매매 원칙이 없습니다. 위에서 첫 원칙을 추가해 주세요.</div>
          )}
          {rules.map((rule, index) => (
            <div key={rule.id} className={`grid gap-4 p-4 lg:grid-cols-[1fr_360px] lg:items-center ${rule.isActive ? "bg-white" : "bg-slate-50"}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{rule.category}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${rule.isActive ? "bg-green-50 text-green-700" : "bg-slate-200 text-slate-500"}`}>{rule.isActive ? "활성" : "비활성"}</span>
                </div>
                <div className="mt-2 text-base font-black text-slate-950">{rule.sortOrder}. {rule.title}</div>
                {rule.description && <p className="mt-2 text-sm leading-6 text-slate-500">{rule.description}</p>}
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={() => moveRule(rule.id, -1)} disabled={!admin || index === 0}>위로</button>
                <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={() => moveRule(rule.id, 1)} disabled={!admin || index === rules.length - 1}>아래로</button>
                <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={() => toggleActive(rule.id)} disabled={!admin}>{rule.isActive ? "비활성화" : "활성화"}</button>
                <button className="btn btn-secondary px-3 py-2 text-xs" type="button" onClick={() => editRule(rule)} disabled={!admin}>수정</button>
                <button className="btn btn-secondary px-3 py-2 text-xs text-blue-600" type="button" onClick={() => deleteRule(rule.id)} disabled={!admin}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
