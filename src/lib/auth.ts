"use client";

export type AccessRole = "viewer" | "admin";

const ROLE_KEY = "trading-journal-access-role";
const PASSWORD_KEY = "trading-journal-access-password";

export function getAccessRole(): AccessRole | null {
  if (typeof window === "undefined") return null;
  const role = window.localStorage.getItem(ROLE_KEY);
  return role === "viewer" || role === "admin" ? role : null;
}

export function isAdminMode(): boolean {
  return getAccessRole() === "admin";
}

export function getAccessPassword(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PASSWORD_KEY) ?? "";
}

export function saveAccess(role: AccessRole, password: string): void {
  window.localStorage.setItem(ROLE_KEY, role);
  window.localStorage.setItem(PASSWORD_KEY, password);
}

export function clearAccess(): void {
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(PASSWORD_KEY);
}
