"use client";

import { useRouter } from "next/navigation";
import { AccountBalanceForm } from "@/components/AccountBalanceForm";
import { addAccountBalanceSnapshot } from "@/lib/store";
import type { AccountBalanceSnapshot } from "@/types/trading";

export function NewAccountBalancePage() {
  const router = useRouter();

  function save(snapshot: AccountBalanceSnapshot) {
    addAccountBalanceSnapshot(snapshot);
    router.push("/accounts");
  }

  return (
    <AccountBalanceForm
      mode="create"
      title="계좌 잔고 등록"
      description="매매일지와 분리해서 수기로 계좌별 잔고를 기록합니다."
      onSave={save}
    />
  );
}
