import { pnlClass } from "@/lib/format";

export function KpiCard({
  label,
  value,
  tone = "neutral",
  caption,
  icon
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pnl";
  caption?: string;
  icon?: string;
}) {
  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return (
    <div className="card min-h-[116px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-bold text-slate-500">{label}</div>
        {icon && <div className="rounded-lg bg-blue-50 px-2 py-1 text-sm text-blue-600">{icon}</div>}
      </div>
      <div className={`mt-3 text-2xl font-black tracking-tight ${tone === "pnl" ? pnlClass(numeric) : "text-ink"}`}>{value}</div>
      <div className="mt-2 text-xs font-semibold text-slate-400">{caption ?? "전일 대비 데이터 준비중"}</div>
    </div>
  );
}
