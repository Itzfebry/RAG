/**
 * Helper UI admin yang dipakai bersama oleh AdminPanel & komponen tab.
 *
 * Diekstrak dari AdminPanel.tsx (Phase B); logika & tampilan tidak diubah.
 * Color + formatting + komponen chart kecil (tooltip, delta chip, gauge budget).
 */

import React from "react";
import type { TooltipContentProps } from "recharts";

export const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

/* ---- format angka + tooltip chart (rapi, monospace, monokrom) ---- */
export const fmtNum = (n: number | string | readonly (number | string)[] | null | undefined) =>
  Number(n || 0).toLocaleString("id-ID");
export const fmtCompact = (n: number | undefined) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return String(v);
};
export const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
};
export const fmtDayFull = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export type ChartTooltipProps = Partial<TooltipContentProps<number, string>> & { unit?: string };

export function ChartTooltip({ active, payload, label, unit }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((p) => p.value !== undefined && p.value !== null);
  const total = rows.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="min-w-[160px] rounded-lg border border-white/10 bg-[#0c0c10]/95 px-3 py-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur">
      {label !== undefined && label !== null && (
        <p className="mb-1.5 border-b border-white/[0.07] pb-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
          {label}
        </p>
      )}
      {rows.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-5 py-0.5 text-[12.5px]">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span
              className="h-2 w-2 shrink-0 rounded-[3px]"
              style={{ background: p.color || p.stroke || p.fill || "#a1a1aa" }}
            />
            {(p.name || p.dataKey) as React.ReactNode}
          </span>
          <span className="font-mono tabular-nums text-zinc-100">
            {fmtNum(p.value)}
            {unit || ""}
          </span>
        </div>
      ))}
      {rows.length > 1 && (
        <div className="mt-1.5 flex items-center justify-between gap-5 border-t border-white/[0.07] pt-1.5 text-[12.5px]">
          <span className="text-zinc-500">Total</span>
          <span className="font-mono font-semibold tabular-nums text-white">
            {fmtNum(total)}
            {unit || ""}
          </span>
        </div>
      )}
    </div>
  );
}

export function DeltaChip({ v, vs }: { v: number | null; vs?: string }) {
  if (v === null || !Number.isFinite(v)) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[12.5px] text-zinc-500">
        -
      </span>
    );
  }
  const up = v >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-medium tabular-nums ${up ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {up ? "+" : ""}
      {v}%{vs && <span className="font-normal text-zinc-500">{vs}</span>}
    </span>
  );
}

export function BudgetGauge({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const r = 68;
  const c = Math.PI * r;
  const color = p >= 90 ? "#fb7185" : p >= 70 ? "#fbbf24" : "#34d399";
  return (
    <div className="relative mx-auto w-full max-w-[230px]">
      <svg
        viewBox="0 0 180 104"
        className="w-full"
        role="img"
        aria-label={`${Math.round(p)} persen terpakai`}
      >
        <path
          d="M 22 92 A 68 68 0 0 1 158 92"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 22 92 A 68 68 0 0 1 158 92"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className="font-mono text-[26px] font-semibold leading-none tabular-nums text-white">
          {Math.round(p)}%
        </p>
        <p className="mt-1 text-[12.5px] text-zinc-500">terpakai</p>
      </div>
    </div>
  );
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}
