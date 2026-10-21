"use client";

/**
 * Tab Dashboard AdminPanel.
 *
 * Diekstrak dari AdminPanel.tsx (Phase B); markup & logika dipindah apa adanya.
 * Menerima data/aksi via props eksplisit (bukan objek hook) dari AdminPanel.
 */

import React, { type Dispatch, type SetStateAction } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  Coins,
  Cpu,
  Database,
  Layers,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Zap,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  cardBase,
  cardHeaderCls,
  cardContentCls,
  tPage,
  tLabel,
  tCard,
  tSmall,
  tBody,
  sectionHeaderWrap,
} from "../adminStyles";
import {
  COLORS,
  BudgetGauge,
  ChartTooltip,
  DeltaChip,
  fmtCompact,
  fmtDay,
  fmtDateTime,
  fmtDayFull,
  fmtNum,
} from "../lib-helpers";
import type { AdminHealth, AuditRow, ModelCatalogEntry, TokenUsageStats } from "@/lib/api-types";
import type { RealStats, CategoryDatum } from "../hooks/use-admin-tokens";
import type { AdminBootstrapApi } from "../hooks/use-admin-bootstrap";

type ModelConfig = AdminBootstrapApi["modelConfig"];

export type DashboardTabProps = {
  health: AdminHealth | null;
  healthError: boolean;
  auditRows: AuditRow[];
  loadAudit: () => void;
  modelConfig: ModelConfig;
  availableModels: ModelCatalogEntry[];
  categoryData: CategoryDatum[];
  reindexing: boolean;
  runReindex: () => void;
  realStats: RealStats | null;
  tokenStats: TokenUsageStats | null;
  budgetInput: string;
  setBudgetInput: Dispatch<SetStateAction<string>>;
  statsLoading: boolean;
  chartPeriod: "day" | "week" | "month" | "year";
  setChartPeriod: Dispatch<SetStateAction<"day" | "week" | "month" | "year">>;
  tokenDays: number;
  setTokenDays: Dispatch<SetStateAction<number>>;
  fetchStats: (period?: string) => Promise<void>;
  saveTokenBudget: () => Promise<void>;
  rateStats: { rpd: number; rpm: number; tpm: number } | null;
};

export function DashboardTab({
  health,
  healthError,
  auditRows,
  loadAudit,
  modelConfig,
  availableModels,
  categoryData,
  reindexing,
  runReindex,
  realStats,
  tokenStats,
  budgetInput,
  setBudgetInput,
  statsLoading,
  chartPeriod,
  setChartPeriod,
  tokenDays,
  setTokenDays,
  fetchStats,
  saveTokenBudget,
  rateStats,
}: DashboardTabProps) {
  const tokDelta =
    tokenStats && Number(tokenStats.yesterday?.total || 0) > 0
      ? Math.round(
          (100 *
            (Number(tokenStats.today?.total || 0) - Number(tokenStats.yesterday?.total || 0))) /
            Number(tokenStats.yesterday?.total || 1),
        )
      : null;
  const tokAvg14 =
    tokenStats && Array.isArray(tokenStats.daily) && tokenStats.daily.length
      ? Math.round(
          tokenStats.daily.reduce<number>((s, d) => s + Number(d.total || 0), 0) /
            tokenStats.daily.length,
        )
      : 0;
  // rincian periode grafik token (ikut tab 7/14/30 hari)
  const tokPeriod =
    tokenStats && Array.isArray(tokenStats.daily) && tokenStats.daily.length
      ? tokenStats.daily.reduce<{
          prompt: number;
          completion: number;
          total: number;
          peak: number;
        }>(
          (a, d) => ({
            prompt: a.prompt + Number(d.prompt || 0),
            completion: a.completion + Number(d.completion || 0),
            total: a.total + Number(d.total || 0),
            peak: Math.max(a.peak, Number(d.total || 0)),
          }),
          { prompt: 0, completion: 0, total: 0, peak: 0 },
        )
      : { prompt: 0, completion: 0, total: 0, peak: 0 };
  // delta requests: hari terakhir vs hari sebelumnya pada deret dailyRequests
  const reqDelta =
    realStats && Array.isArray(realStats.dailyRequests) && realStats.dailyRequests.length >= 2
      ? (() => {
          const d = realStats.dailyRequests;
          const cur = Number(d[d.length - 1]?.count || 0);
          const prev = Number(d[d.length - 2]?.count || 0);
          return prev > 0 ? Math.round((100 * (cur - prev)) / prev) : null;
        })()
      : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <div className={sectionHeaderWrap}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={tPage}>Dashboard</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[13px] tracking-wide text-zinc-400">
                <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                {tokenStats && Array.isArray(tokenStats.daily) && tokenStats.daily.length
                  ? `${fmtDay(String(tokenStats.daily[0].day))} - ${fmtDay(String(tokenStats.daily[tokenStats.daily.length - 1].day))}`
                  : "memuat tanggal..."}
                <span className="text-zinc-600">|</span> {tokenDays} hari terakhir
              </span>
              {realStats && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[13px] tracking-wide text-zinc-400">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" /> {realStats.uptime}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[13px] font-medium tracking-[0.06em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              LIVE
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStats()}
              disabled={statsLoading}
              className="h-8 border-white/10 bg-white/[0.04] text-[14px] text-zinc-300 gap-1.5"
            >
              {statsLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Activity className="h-3 w-3" />
              )}{" "}
              Refresh
            </Button>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[13px] font-medium tracking-wide text-zinc-400">
              v2.1
            </span>
          </div>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
        aria-label="Status sistem"
      >
        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-[#0a0a0c] p-4">
            <div className="flex items-center justify-between">
              <p className={tLabel}>Backend</p>
              <Activity
                className={`h-4 w-4 ${health && !healthError ? "text-emerald-400" : healthError ? "text-red-400" : "text-zinc-600"}`}
                aria-hidden
              />
            </div>
            <p className="mt-2 flex items-center gap-2 text-[18px] font-semibold text-zinc-100">
              <span
                className={`h-2 w-2 rounded-full ${health && !healthError ? "bg-emerald-400" : healthError ? "bg-red-400" : "bg-zinc-600"}`}
                aria-hidden
              />
              {health && !healthError ? "Online" : healthError ? "Offline" : "Memuat..."}
            </p>
            <p className="mt-1 text-[13px] text-zinc-500">Cek otomatis tiap 30 detik</p>
          </div>
          <div className="bg-[#0a0a0c] p-4">
            <div className="flex items-center justify-between">
              <p className={tLabel}>Database</p>
              <Database
                className={`h-4 w-4 ${health?.database?.ok ? "text-emerald-400" : health ? "text-red-400" : "text-zinc-600"}`}
                aria-hidden
              />
            </div>
            <p className="mt-2 flex items-center gap-2 text-[18px] font-semibold text-zinc-100">
              <span
                className={`h-2 w-2 rounded-full ${health?.database?.ok ? "bg-emerald-400" : health ? "bg-red-400" : "bg-zinc-600"}`}
                aria-hidden
              />
              {health ? (health.database?.ok ? "Terhubung" : "Tidak terhubung") : "Memuat..."}
            </p>
            <p className="mt-1 text-[13px] text-zinc-500">
              Mode: <span className="font-mono text-zinc-400">{health?.database?.mode || "-"}</span>
            </p>
          </div>
          <div className="bg-[#0a0a0c] p-4">
            <div className="flex items-center justify-between">
              <p className={tLabel}>Token hari ini</p>
              <Coins className="h-4 w-4 text-amber-400" aria-hidden />
            </div>
            {health?.token_budget ? (
              <>
                <p
                  className={`mt-2 font-mono text-[18px] font-semibold tabular-nums ${health.token_budget.remaining !== null && health.token_budget.remaining < 0 ? "text-red-300" : "text-zinc-100"}`}
                >
                  {fmtNum(health.token_budget.today)}
                  {health.token_budget.budget > 0 && (
                    <span className="text-[13px] font-normal text-zinc-500">
                      {" "}
                      / {fmtNum(health.token_budget.budget)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-zinc-500">
                  {health.token_budget.budget === 0
                    ? "Budget: tanpa batas"
                    : Number(health.token_budget.remaining) < 0
                      ? "Budget terlampaui"
                      : `Sisa ${fmtNum(health.token_budget.remaining)}`}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[18px] font-semibold text-zinc-500">-</p>
            )}
          </div>
          <div className="bg-[#0a0a0c] p-4">
            <div className="flex items-center justify-between">
              <p className={tLabel}>Model AI</p>
              <Cpu className="h-4 w-4 text-emerald-400" aria-hidden />
            </div>
            <p
              className="mt-2 truncate font-mono text-[15px] font-semibold text-zinc-100"
              title={modelConfig.active_model}
            >
              {modelConfig.active_model || "-"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-zinc-500">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              Fallback:{" "}
              <span className="font-mono text-zinc-300">{modelConfig.fallback_models.length}</span>
              {modelConfig.fallback_models.length > 0 && (
                <span
                  className="truncate font-mono text-zinc-500"
                  title={modelConfig.fallback_models.join(", ")}
                >
                  · {modelConfig.fallback_models[0]}
                  {modelConfig.fallback_models.length > 1
                    ? ` +${modelConfig.fallback_models.length - 1}`
                    : ""}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-[13px]">
          <p className="text-zinc-500">
            Error login terakhir:{" "}
            {health?.last_login_failure ? (
              <span className="text-amber-300">
                {fmtDateTime(health.last_login_failure.created_at)} ·{" "}
                {health.last_login_failure.actor} · {health.last_login_failure.detail}
              </span>
            ) : (
              <span className="text-zinc-400">tidak ada</span>
            )}
          </p>
          <button
            type="button"
            onClick={runReindex}
            disabled={reindexing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[13px] text-zinc-200 hover:bg-white/[0.1] disabled:opacity-50"
          >
            {reindexing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Database className="h-3.5 w-3.5" aria-hidden />
            )}
            {reindexing ? "Mengindeks ulang..." : "Reindex knowledge"}
          </button>
        </div>
      </section>

      {!realStats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className={cardBase}>
              <CardContent className="p-5">
                <div className="h-14 animate-pulse rounded-lg bg-white/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPI row ala referensi: icon kanan-atas, delta chip, sub "vs ..." */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Total Requests",
                value: fmtNum(realStats.totalRequests),
                delta: reqDelta,
                vs: "last day",
                sub: `${realStats.totalPromptsUsed} user + ${realStats.trialTotalUsed} trial`,
                icon: TrendingUp,
                iconBg: "bg-emerald-500/10 border-emerald-500/15",
                iconColor: "text-emerald-400",
              },
              {
                label: "Users",
                value: `${realStats.activeUsers}/${realStats.totalUsers}`,
                delta: null,
                vs: "",
                sub: `${realStats.disabledUsers} nonaktif · ${realStats.exhausted} quota habis · ${realStats.unlimitedUsers} ∞`,
                icon: User,
                iconBg: "bg-sky-500/10 border-sky-500/15",
                iconColor: "text-sky-400",
              },
              {
                label: "Token Hari Ini",
                value: tokenStats ? fmtNum(tokenStats.today?.total) : "-",
                delta: tokDelta,
                vs: "last day",
                sub: tokenStats
                  ? `${fmtNum(tokenStats.today?.prompt)} prompt · ${fmtNum(tokenStats.today?.completion)} completion`
                  : "memuat...",
                icon: Coins,
                iconBg: "bg-violet-500/10 border-violet-500/15",
                iconColor: "text-violet-400",
              },
              {
                label: "Total Token",
                value: tokenStats ? fmtNum(tokenStats.total?.total) : "-",
                delta: null,
                vs: "",
                sub: tokenStats
                  ? `rata2 ${fmtNum(tokAvg14)}/hari · ${fmtNum(tokenStats.total?.prompt)} prompt`
                  : "sejak awal",
                icon: Zap,
                iconBg: "bg-amber-500/10 border-amber-500/15",
                iconColor: "text-amber-400",
              },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                >
                  <Card className={`${cardBase} hover:border-white/[0.12] transition-colors`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className={tLabel}>{stat.label}</p>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${stat.iconBg}`}
                          aria-hidden
                        >
                          <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                        </span>
                      </div>
                      <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
                        {stat.value}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        {stat.delta !== null && <DeltaChip v={stat.delta} vs={stat.vs} />}
                        <p className="text-[13px] leading-none text-zinc-500 truncate">
                          {stat.sub}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Rate live: RPM / TPM (jendela 60 detik) + RPD hari ini */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: "RPM",
                hint: "request / menit terakhir",
                value: rateStats ? String(rateStats.rpm) : "-",
                icon: Activity,
                iconColor: "text-sky-400",
                iconBg: "bg-sky-500/10 border-sky-500/15",
              },
              {
                label: "TPM",
                hint: "token / menit terakhir",
                value: rateStats ? fmtNum(rateStats.tpm) : "-",
                icon: Coins,
                iconColor: "text-violet-400",
                iconBg: "bg-violet-500/10 border-violet-500/15",
              },
              {
                label: "RPD",
                hint: "request hari ini",
                value: rateStats ? fmtNum(rateStats.rpd) : "-",
                icon: CalendarDays,
                iconColor: "text-emerald-400",
                iconBg: "bg-emerald-500/10 border-emerald-500/15",
              },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.label} className={cardBase}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className={`${tLabel} flex items-center gap-1.5`}>
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"
                          aria-hidden
                        />
                        {m.label}
                      </p>
                      <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-white tabular-nums">
                        {m.value}
                      </p>
                      <p className={tSmall}>{m.hint}</p>
                    </div>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${m.iconBg}`}
                      aria-hidden
                    >
                      <Icon className={`h-4 w-4 ${m.iconColor}`} />
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* HERO: grafik token + delta + tab periode + 3 mini stat (alà Total Profit) */}
            <Card className={`${cardBase} lg:col-span-2`}>
              <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={tLabel}>Penggunaan Token</p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <p className="text-[34px] font-semibold leading-none tracking-tight text-white tabular-nums">
                        {tokenStats ? fmtNum(tokenStats.today?.total) : "-"}
                      </p>
                      <DeltaChip v={tokDelta} vs="kemarin" />
                    </div>
                    <p className="mt-2 text-[13px] text-zinc-500">
                      hari ini · {tokenStats ? fmtNum(tokenStats.today?.prompt) : "-"} prompt +{" "}
                      {tokenStats ? fmtNum(tokenStats.today?.completion) : "-"} completion
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
                    {[7, 14, 30].map((n) => (
                      <button
                        key={n}
                        onClick={() => setTokenDays(n)}
                        className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${tokenDays === n ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
                      >
                        {n}H
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {!tokenStats ||
                !Array.isArray(tokenStats.daily) ||
                tokenStats.daily.every((d) => !d.total) ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">
                    Belum ada token terpakai - chat dulu untuk isi data.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={tokenStats.daily.map((d) => ({
                        day: fmtDay(String(d.day)),
                        prompt: d.prompt,
                        completion: d.completion,
                        total: d.total,
                        full: fmtDayFull(String(d.day)),
                      }))}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gradPrompt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradCompletion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        opacity={0.35}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        interval={0}
                        tickLine={false}
                        axisLine={{ stroke: "#27272a" }}
                      />
                      <YAxis
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        allowDecimals={false}
                        tickFormatter={fmtCompact}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.full || _}
                      />
                      <ReferenceLine
                        y={tokAvg14}
                        stroke="#71717a"
                        strokeDasharray="4 4"
                        label={{
                          value: `rata2 ${fmtCompact(tokAvg14)}`,
                          position: "insideTopRight",
                          fill: "#71717a",
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="prompt"
                        name="Prompt"
                        stackId="tok"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#gradPrompt)"
                      />
                      <Area
                        type="monotone"
                        dataKey="completion"
                        name="Completion"
                        stackId="tok"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        fill="url(#gradCompletion)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {/* 3 mini stat alà Active/Inactive/Churned */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      k: "Prompt (input)",
                      v: tokenStats ? fmtNum(tokenStats.today?.prompt) : "-",
                      c: "bg-violet-500",
                      iconBg: "bg-violet-500/10",
                      iconColor: "text-violet-400",
                      icon: MessageSquare,
                    },
                    {
                      k: "Completion (output)",
                      v: tokenStats ? fmtNum(tokenStats.today?.completion) : "-",
                      c: "bg-sky-400",
                      iconBg: "bg-sky-500/10",
                      iconColor: "text-sky-400",
                      icon: Sparkles,
                    },
                    {
                      k: `Puncak ${tokenDays} hari`,
                      v: tokenStats ? fmtNum(tokPeriod.peak) : "-",
                      c: "bg-amber-400",
                      iconBg: "bg-amber-500/10",
                      iconColor: "text-amber-400",
                      icon: Target,
                    },
                  ].map((m) => {
                    const I = m.icon;
                    return (
                      <div
                        key={m.k}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.iconBg}`}
                          aria-hidden
                        >
                          <I className={`h-4 w-4 ${m.iconColor}`} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] text-zinc-500">{m.k}</p>
                          <p className="mt-0.5 font-mono text-[17px] font-semibold leading-none text-zinc-100 tabular-nums">
                            {m.v}
                          </p>
                        </div>
                        <span
                          className={`ml-auto h-8 w-1 shrink-0 rounded-full ${m.c}`}
                          aria-hidden
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Right column: gauge budget + hari terpadat + model (alà Repeat Rate / Most Active / AI Assistant) */}
            <div className="flex flex-col gap-4 [&>*]:flex-1">
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={`${tCard} flex items-center gap-2`}>
                    <Coins className="h-3.5 w-3.5 text-amber-400" /> Budget Harian
                  </CardTitle>
                </CardHeader>
                <CardContent className={cardContentCls}>
                  {tokenStats ? (
                    <BudgetGauge
                      pct={
                        (100 * Number(tokenStats.today?.total || 0)) /
                        Math.max(1, Number(tokenStats.budget))
                      }
                    />
                  ) : (
                    <div className="py-6 text-center">
                      <p className="font-mono text-[30px] leading-none text-white">∞</p>
                      <p className="mt-2 text-[13px] text-zinc-500">tanpa batas harian</p>
                    </div>
                  )}
                  {tokenStats && Number(tokenStats.budget) > 0 && (
                    <p className="mt-1 text-center text-[13px] text-zinc-500">
                      <span className="font-mono tabular-nums text-zinc-300">
                        {fmtNum(tokenStats.today?.total)}
                      </span>{" "}
                      /{" "}
                      <span className="font-mono tabular-nums text-zinc-300">
                        {fmtNum(tokenStats.budget)}
                      </span>{" "}
                      token
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4">
                    <input
                      type="number"
                      min={0}
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="h-9 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-[14px] tabular-nums text-zinc-100 outline-none focus:border-white/25"
                      aria-label="Budget token harian"
                    />
                    <button
                      onClick={saveTokenBudget}
                      className="h-9 shrink-0 rounded-lg bg-white px-4 text-[14px] font-semibold text-black transition-colors hover:bg-zinc-200"
                    >
                      Simpan
                    </button>
                  </div>
                  <p className="mt-2 text-[13px] text-zinc-500">0 = tanpa batas.</p>
                </CardContent>
              </Card>

              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={`${tCard} flex items-center gap-2`}>
                    <Target className="h-3.5 w-3.5 text-sky-400" /> Hari Terpadat
                  </CardTitle>
                </CardHeader>
                <CardContent className={cardContentCls}>
                  {tokenStats &&
                  Array.isArray(tokenStats.daily) &&
                  tokenStats.daily.some((d) => d.total > 0) ? (
                    (() => {
                      const sorted = [...tokenStats.daily]
                        .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
                        .slice(0, 3);
                      return (
                        <div className="space-y-3">
                          {sorted.map((d, i) => {
                            const pct =
                              Number(sorted[0]?.total) > 0
                                ? Math.round((100 * Number(d.total || 0)) / Number(sorted[0].total))
                                : 0;
                            return (
                              <div key={d.day}>
                                <div className="mb-1 flex items-center justify-between text-[13px]">
                                  <span className="text-zinc-400">
                                    <span className="mr-1.5 font-mono text-zinc-600">#{i + 1}</span>
                                    {fmtDayFull(String(d.day))}
                                  </span>
                                  <span className="font-mono tabular-nums text-zinc-200">
                                    {fmtNum(d.total)}
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                  <div
                                    className="h-full rounded-full bg-sky-400/80 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-6 text-center text-[14px] text-zinc-500">
                      Belum ada data.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={`${tCard} flex items-center gap-2`}>
                    <Cpu className="h-3.5 w-3.5 text-emerald-400" /> Model AI
                  </CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} space-y-2.5`}>
                  <div className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-zinc-500">Aktif</span>
                    <span
                      className="truncate font-mono text-zinc-200"
                      title={modelConfig.active_model}
                    >
                      {modelConfig.active_model || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-zinc-500">Fallback</span>
                    <span className="font-mono tabular-nums text-zinc-200">
                      {modelConfig.fallback_models.length} model
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-zinc-500">Katalog siap</span>
                    <span className="font-mono tabular-nums text-zinc-200">
                      {availableModels.length} model
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-zinc-500">Knowledge</span>
                    <span className="font-mono tabular-nums text-zinc-200">
                      {realStats.knowledgeEntries} entri
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className={`${tCard} flex items-center gap-2`}>
                    <Activity className="h-3.5 w-3.5 text-sky-400" /> Total Requests
                  </CardTitle>
                  <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[13px]">
                    {(["day", "week", "month", "year"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setChartPeriod(p);
                          fetchStats(p);
                        }}
                        className={`rounded-full px-2.5 py-1 capitalize transition ${chartPeriod === p ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
                      >
                        {p === "day"
                          ? "Day"
                          : p === "week"
                            ? "Week"
                            : p === "month"
                              ? "Month"
                              : "Year"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {!realStats.dailyRequests || realStats.dailyRequests.length === 0 ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">Belum ada data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={realStats.dailyRequests.map((d) => {
                        const lab = String(d.day);
                        const short = chartPeriod === "day" ? fmtDay(lab) : lab;
                        return {
                          day: short,
                          count: d.count,
                          full: chartPeriod === "day" ? fmtDayFull(lab) : lab,
                        };
                      })}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        opacity={0.35}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        interval={0}
                        tickLine={false}
                        axisLine={{ stroke: "#27272a" }}
                      />
                      <YAxis
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        allowDecimals={false}
                        tickFormatter={fmtCompact}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip unit=" req" />}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.full || _}
                      />
                      <Bar dataKey="count" name="Requests" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={`${tCard} flex items-center gap-2`}>
                  <Clock className="h-3.5 w-3.5 text-amber-400" /> Response Time Rata2 Models (ms)
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {!realStats.dailyLatency ||
                realStats.dailyLatency.every((d) => d.avg_ms == null) ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">
                    Belum ada latency - chat dulu untuk isi data.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={realStats.dailyLatency.map((d) => {
                        const lab = String(d.day);
                        const short = chartPeriod === "day" ? fmtDay(lab) : lab;
                        return {
                          day: short,
                          avg_ms: d.avg_ms,
                          full: chartPeriod === "day" ? fmtDayFull(lab) : lab,
                        };
                      })}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        opacity={0.35}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        interval={0}
                        tickLine={false}
                        axisLine={{ stroke: "#27272a" }}
                      />
                      <YAxis
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        tickFormatter={fmtCompact}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip unit=" ms" />}
                        cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.full || _}
                      />
                      <Line
                        type="linear"
                        dataKey="avg_ms"
                        name="Rata-rata"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: "#0c0c10", stroke: "#f59e0b", strokeWidth: 2 }}
                        activeDot={{
                          r: 4.5,
                          fill: "#f59e0b",
                          stroke: "#0c0c10",
                          strokeWidth: 2,
                        }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {realStats.dailyLatency &&
                  (() => {
                    const agg: Record<string, { sum: number; cnt: number }> = {};
                    realStats.dailyLatency.forEach((d) =>
                      (d.models || []).forEach((m) => {
                        const k = m.model || "unknown";
                        if (!agg[k]) agg[k] = { sum: 0, cnt: 0 };
                        agg[k].sum += (m.avg_ms || 0) * (m.count || 1);
                        agg[k].cnt += m.count || 1;
                      }),
                    );
                    const rows = Object.entries(agg)
                      .map(([model, v]) => ({
                        model,
                        avg_ms: Math.round(v.sum / Math.max(1, v.cnt)),
                        count: v.cnt,
                      }))
                      .sort((a, b) => a.avg_ms - b.avg_ms)
                      .slice(0, 6);
                    const label =
                      chartPeriod === "day"
                        ? "14 hari"
                        : chartPeriod === "week"
                          ? "12 minggu"
                          : chartPeriod === "month"
                            ? "12 bulan"
                            : "6 tahun";
                    return rows.length ? (
                      <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
                        <p className="text-[13px] font-medium tracking-[0.06em] text-zinc-500 uppercase">
                          Rata-rata per model ({label})
                        </p>
                        {rows.map((r) => (
                          <div
                            key={r.model}
                            className="flex items-center justify-between gap-2 text-[16px]"
                          >
                            <span
                              className="truncate font-mono text-zinc-300 text-[14px]"
                              title={r.model}
                            >
                              {r.model}
                            </span>
                            <span className="shrink-0 tabular-nums text-zinc-400 text-[14px]">
                              {r.avg_ms} ms · {r.count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
              </CardContent>
            </Card>
          </div>

          {/* Grafik token harian + kontribusi per user */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={`${tCard} flex items-center gap-2`}>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Tren Token Harian
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {!Array.isArray(tokenStats?.daily) || tokenStats!.daily!.length === 0 ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">
                    Belum ada token tercatat.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart
                      data={tokenStats!.daily!.map((d) => ({
                        day: fmtDay(String(d.day)),
                        full: fmtDayFull(String(d.day)),
                        prompt: d.prompt ?? 0,
                        completion: d.completion ?? 0,
                      }))}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="tokPrompt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.06} />
                        </linearGradient>
                        <linearGradient id="tokCompletion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.06} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        opacity={0.35}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        tickLine={false}
                        axisLine={{ stroke: "#27272a" }}
                      />
                      <YAxis
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        tickFormatter={fmtCompact}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip unit=" token" />}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.full || _}
                      />
                      <Area
                        type="monotone"
                        dataKey="prompt"
                        name="Prompt"
                        stackId="tok"
                        stroke="#8b5cf6"
                        strokeWidth={1.5}
                        fill="url(#tokPrompt)"
                      />
                      <Area
                        type="monotone"
                        dataKey="completion"
                        name="Completion"
                        stackId="tok"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        fill="url(#tokCompletion)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={`${tCard} flex items-center gap-2`}>
                  <User className="h-3.5 w-3.5 text-sky-400" /> Token per User
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {!Array.isArray(tokenStats?.by_user) || tokenStats!.by_user!.length === 0 ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">
                    Belum ada token tercatat.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      layout="vertical"
                      data={tokenStats!.by_user!.map((r) => ({
                        label: r.label || r.owner || "-",
                        prompt: r.prompt ?? 0,
                        completion: r.completion ?? 0,
                        full: r.label || r.owner || "-",
                      }))}
                      margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        opacity={0.35}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        tickFormatter={fmtCompact}
                        axisLine={{ stroke: "#27272a" }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        width={110}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip unit=" token" />}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar
                        dataKey="prompt"
                        name="Prompt"
                        stackId="u"
                        fill="#8b5cf6"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="completion"
                        name="Completion"
                        stackId="u"
                        fill="#38bdf8"
                        radius={[0, 3, 3, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Token per user (kumulatif + hari ini) */}
          <Card className={cardBase}>
            <CardHeader className={cardHeaderCls}>
              <CardTitle className={`${tCard} flex items-center gap-2`}>
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Token per User
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentCls}>
              {!tokenStats ||
              !Array.isArray(tokenStats.by_user) ||
              tokenStats.by_user.length === 0 ? (
                <div className="py-10 text-center text-[16px] text-zinc-500">
                  Belum ada token tercatat.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-left text-[13px] text-zinc-500">
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="px-3 py-2 text-right font-medium">Hari Ini</th>
                        <th className="px-3 py-2 text-right font-medium">Prompt</th>
                        <th className="px-3 py-2 text-right font-medium">Completion</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">Kontribusi</th>
                        <th className="px-3 py-2 text-right font-medium">Kuota Prompt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenStats.by_user.map((r) => (
                        <tr key={r.owner} className="border-b border-white/[0.04] text-zinc-300">
                          <td className="max-w-[220px] truncate px-3 py-2.5">
                            {r.label}
                            {r.kind === "trial" && (
                              <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[12px] text-zinc-400">
                                trial
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {fmtNum(r.today)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {fmtNum(r.prompt)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {fmtNum(r.completion)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-medium tabular-nums text-zinc-100">
                            {fmtNum(r.total)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full bg-violet-400/80"
                                  style={{
                                    width: `${Math.min(100, Number(r.share || 0))}%`,
                                  }}
                                />
                              </div>
                              <span className="w-12 text-right font-mono tabular-nums text-zinc-500">
                                {Number(r.share || 0).toLocaleString("id-ID", {
                                  maximumFractionDigits: 1,
                                })}
                                %
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                            {r.kind === "user"
                              ? Number(r.max_prompts) > 0
                                ? `${r.prompts_used}/${r.max_prompts}`
                                : `${r.prompts_used} ∞`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={tCard}>
                  <span className="flex items-center justify-between gap-2 w-full">
                    <span className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-emerald-400" /> Ready - Katalog
                    </span>
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.06] text-zinc-300 font-mono text-[13px] tabular-nums"
                    >
                      {availableModels.length} model
                    </Badge>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {availableModels.length === 0 ? (
                  <p className={tBody}>
                    Belum load katalog. Buka tab AI Models → isi Kredensial Katalog → Muat ulang.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-auto pr-1">
                    {availableModels.slice(0, 24).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex max-w-[220px] truncate rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[13px] font-medium text-zinc-300"
                        title={m.id}
                      >
                        {m.name ? `${m.name} - ${m.id}` : m.id}
                      </span>
                    ))}
                    {availableModels.length > 24 && (
                      <span className="text-[13px] text-zinc-500">
                        +{availableModels.length - 24} lagi
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={tCard}>
                  <span className="flex items-center justify-between gap-2 w-full">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-amber-400" /> Fallback Chain
                    </span>
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.06] text-zinc-300 font-mono text-[13px] tabular-nums"
                    >
                      {modelConfig.fallback_models.length} model
                    </Badge>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {modelConfig.fallback_models.length === 0 ? (
                  <p className={tSmall}>Belum ada fallback. Tambah di AI Models.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {modelConfig.fallback_models.map((mid: string) => {
                      const isActive = mid === modelConfig.active_model;
                      return (
                        <span
                          key={mid}
                          className={`inline-flex max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[13px] font-medium ${isActive ? "border-white/15 bg-white/10 text-zinc-200" : "border-white/10 bg-white/[0.06] text-zinc-300"}`}
                          title={mid}
                        >
                          {mid}
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="mt-3 text-[13px] text-zinc-500">
                  Aktif:{" "}
                  <span className="font-mono text-zinc-300">{modelConfig.active_model || "-"}</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={`${tCard} flex items-center gap-2`}>
                  <Database className="h-3.5 w-3.5 text-violet-400" /> Knowledge by Category
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {categoryData.length === 0 ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">
                    Belum ada knowledge.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={90}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#09090b",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "10px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className={cardBase}>
              <CardHeader className={cardHeaderCls}>
                <CardTitle className={`${tCard} flex items-center gap-2`}>
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Top Prompts by User
                </CardTitle>
              </CardHeader>
              <CardContent className={cardContentCls}>
                {!realStats.topPrompts || realStats.topPrompts.length === 0 ? (
                  <div className="py-16 text-center text-[16px] text-zinc-500">
                    Belum ada usage.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={realStats.topPrompts}
                      layout="vertical"
                      margin={{ left: 12, right: 16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        opacity={0.35}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="#52525b"
                        fontSize={11}
                        fontFamily="monospace"
                        tickFormatter={fmtCompact}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="username"
                        stroke="#a1a1aa"
                        fontSize={11}
                        fontFamily="monospace"
                        width={90}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip unit=" prompt" />}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar
                        dataKey="prompts_used"
                        name="Prompt terpakai"
                        fill="#34d399"
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className={cardBase}>
            <CardHeader className={cardHeaderCls}>
              <CardTitle className={`${tCard} flex items-center gap-2`}>
                <Activity className="h-3.5 w-3.5 text-emerald-400" /> System
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentCls}>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <span className={tLabel}>Uptime</span>
                  <span className="text-[16px] font-medium tracking-tight text-zinc-200 tabular-nums">
                    {realStats.uptime} · ONLINE
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <span className={tLabel}>API</span>
                  <span className="text-[16px] font-medium tracking-tight text-zinc-200">
                    READY · LIVE
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                  <span className={tLabel}>Model</span>
                  <span className="text-[16px] font-medium text-zinc-200 truncate max-w-[160px] tabular-nums">
                    {modelConfig.active_model.split("/")[1]?.slice(0, 22) || "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <section
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
            aria-label="Audit log"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className={tLabel}>Log aktivitas admin (20 terakhir)</p>
              <button
                type="button"
                onClick={loadAudit}
                className="text-[13px] text-zinc-400 hover:text-zinc-200"
              >
                Muat ulang
              </button>
            </div>
            {auditRows.filter((r) => !String(r.action).startsWith("user_")).length === 0 ? (
              <p className="text-[14px] text-zinc-500">Belum ada aktivitas tercatat.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05] text-[13px]">
                {auditRows
                  .filter((r) => !String(r.action).startsWith("user_"))
                  .slice(0, 20)
                  .map((r) => (
                    <li
                      key={`${r.created_at}-${r.action}-${r.actor}`}
                      className="flex flex-wrap gap-x-3 gap-y-0.5 py-2"
                    >
                      <span className="font-mono text-zinc-500">{fmtDateTime(r.created_at)}</span>
                      <span className="text-zinc-300">{r.actor}</span>
                      <span className="text-zinc-400">{r.action}</span>
                      {r.target && <span className="font-mono text-zinc-500">{r.target}</span>}
                      {r.detail && <span className="text-zinc-500">{r.detail}</span>}
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
            aria-label="Log login user"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className={tLabel}>Log login user (20 terakhir)</p>
              <button
                type="button"
                onClick={loadAudit}
                className="text-[13px] text-zinc-400 hover:text-zinc-200"
              >
                Muat ulang
              </button>
            </div>
            {auditRows.filter((r) => String(r.action).startsWith("user_")).length === 0 ? (
              <p className="text-[14px] text-zinc-500">Belum ada login user tercatat.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05] text-[13px]">
                {auditRows
                  .filter((r) => String(r.action).startsWith("user_"))
                  .slice(0, 20)
                  .map((r) => (
                    <li
                      key={`${r.created_at}-${r.action}-${r.actor}`}
                      className="flex flex-wrap gap-x-3 gap-y-0.5 py-2"
                    >
                      <span className="font-mono text-zinc-500">{fmtDateTime(r.created_at)}</span>
                      <span className="text-zinc-300">{r.actor}</span>
                      <span
                        className={
                          r.action === "user_login_failed" ? "text-red-300" : "text-emerald-300"
                        }
                      >
                        {r.action}
                      </span>
                      {r.ip && <span className="font-mono text-zinc-500">{r.ip}</span>}
                      {r.detail && <span className="text-zinc-500">{r.detail}</span>}
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
