"use client";

import { useEffect, useState } from "react";
import { clearAccess, getAccessPassword, getAccessRole, saveAccess, type AccessRole } from "@/lib/auth";
import { hydrateLocalStateFromCloud } from "@/lib/store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AccessRole | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existingRole = getAccessRole();
    const existingPassword = getAccessPassword();
    if (!existingRole || !existingPassword) {
      setRole(null);
      return;
    }

    hydrateLocalStateFromCloud(existingPassword)
      .catch(() => undefined)
      .finally(() => setRole(existingRole));
  }, []);

  async function login() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        setError("비밀번호가 맞지 않습니다.");
        return;
      }
      const data = (await response.json()) as { role: AccessRole };
      saveAccess(data.role, password);
      await hydrateLocalStateFromCloud(password);
      setRole(data.role);
    } finally {
      setLoading(false);
    }
  }

  if (role === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-500">데이터를 불러오는 중입니다.</div>;
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="card w-full max-w-md p-6">
          <h1 className="text-2xl font-black text-slate-950">매매일지 접근</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">공유받은 보기 비밀번호 또는 관리자 비밀번호를 입력하세요.</p>
          <input
            className="input mt-5"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void login();
            }}
            placeholder="비밀번호"
          />
          {error && <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-600">{error}</div>}
          <button className="btn btn-primary mt-4 w-full" type="button" onClick={login} disabled={loading}>
            {loading ? "확인 중..." : "입장"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm">
        <span className={role === "admin" ? "text-red-500" : "text-blue-600"}>{role === "admin" ? "관리자" : "보기 전용"}</span>
        <button
          className="text-slate-500 underline"
          type="button"
          onClick={() => {
            clearAccess();
            window.location.reload();
          }}
        >
          나가기
        </button>
      </div>
    </>
  );
}
