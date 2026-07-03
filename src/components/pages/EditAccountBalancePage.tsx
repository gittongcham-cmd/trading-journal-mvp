"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountBalanceForm } from "@/components/AccountBalanceForm";
import { loadAccountBalanceSnapshots, updateAccountBalanceSnapshot } from "@/lib/store";
import type { AccountBalanceSnapshot } from "@/types/trading";

export function EditAccountBalancePage({ id }: { id: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AccountBalanceSnapshot | null | undefined>(undefined);

  useEffect(() => {
    const found = loadAccountBalanceSnapshots().find((item) => item.id === id) ?? null;
    setSnapshot(found);
  }, [id]);

  function save(nextSnapshot: AccountBalanceSnapshot) {
    updateAccountBalanceSnapshot(nextSnapshot);
    router.push("/accounts");
  }

  if (snapshot === undefined) {
    return <div className="card p-5 text-sm font-semibold text-slate-500">계좌 잔고 기록을 불러오는 중입니다.</div>;
  }

  if (snapshot === null) {
    return (
      <div className="card p-5">
        <h1 className="text-xl font-black">계좌 잔고 기록을 찾을 수 없습니다.</h1>
        <Link className="btn btn-secondary mt-4" href="/accounts">계좌기록으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <AccountBalanceForm
      mode="edit"
      title="계좌 잔고 수정"
      description="기존 계좌 잔고 기록의 은행명, 계좌번호, 금액, 메모를 수정합니다."
      initialSnapshot={snapshot}
      onSave={save}
    />
  );
}
