export function formatKRW(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value))}원`;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${formatNumber(value, 2)}%`;
}

export function formatPoint(value: number): string {
  return `${formatNumber(value, 2)}pt`;
}

export function pnlClass(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-slate-600";
}
