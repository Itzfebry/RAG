/**
 * Hook data admin - statistik dashboard & token usage.
 *
 * Diekstrak dari AdminPanel.tsx (Phase A); logika & bentuk payload tidak diubah.
 *
 * Deps:
 * - `isAuthenticated`  : dari useAdminBootstrap (fetchStats hanya jalan saat auth).
 * - `setCategoryData`  : dispatch categoryData dari useAdminKnowledge
 *   (dashboard pie chart; fetchStats mengisinya dari knowledgeByCategory).
 * - `authExpired` / `pushToast` : guard sesi & notifikasi AdminPanel.
 *
 * Mengembalikan state realStats/tokenStats/budgetInput dsb + fetchStats &
 * saveTokenBudget. Nilai derivatif (tokDelta, tokAvg14, dst.) tetap dihitung
 * di AdminPanel seperti sebelumnya.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, fetchApi } from "@/lib/fetch-api";
import type { AdminPushToast, TokenUsageStats } from "@/lib/api-types";

export type RealStats = {
  totalRequests: number;
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  knowledgeEntries: number;
  totalPromptsUsed: number;
  trialTotalUsed: number;
  exhausted: number;
  unlimitedUsers: number;
  avgPrompts: number;
  uptime: string;
  uptimeSeconds: number;
  knowledgeByCategory: { name: string; value: number }[];
  topPrompts: { username: string; prompts_used: number; max_prompts: number }[];
  dailyRequests: { day: string; count: number }[];
  dailyLatency: {
    day: string;
    avg_ms: number | null;
    models: { model: string; avg_ms: number; count: number }[];
  }[];
  periodMeta?: { period: string; limit: number };
};

export type CategoryDatum = { name: string; value: number };
export type CategoryDataSetter = Dispatch<SetStateAction<CategoryDatum[]>>;

export type AdminTokensDeps = {
  authExpired: (status: number) => boolean;
  pushToast: AdminPushToast;
  isAuthenticated: boolean;
  setCategoryData: CategoryDataSetter;
};

export function useAdminTokens({
  authExpired,
  pushToast,
  isAuthenticated,
  setCategoryData,
}: AdminTokensDeps) {
  const [realStats, setRealStats] = useState<RealStats | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenUsageStats | null>(null);
  const [budgetInput, setBudgetInput] = useState("0");
  const [statsLoading, setStatsLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month" | "year">("day");
  const [tokenDays, setTokenDays] = useState<number>(14);

  const fetchStats = useCallback(
    async (period?: string) => {
      if (!isAuthenticated) return;
      setStatsLoading(true);
      try {
        const p = (period || chartPeriod) as string;
        const qs =
          p !== "day"
            ? `?period=${p}&limit=${p === "day" ? 14 : p === "week" ? 12 : p === "month" ? 12 : 6}`
            : "";
        const j = await fetchApi<RealStats>(`/api/python/admin/stats${qs}`);
        setRealStats(j);
        if (Array.isArray(j.knowledgeByCategory) && j.knowledgeByCategory.length) {
          setCategoryData(j.knowledgeByCategory);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      }
      // agregasi token: harian, sisa budget, per user
      try {
        const tj = await fetchApi<TokenUsageStats>(
          `/api/python/admin/token-usage?days=${tokenDays}`,
        );
        setTokenStats(tj);
      } catch {}
      setStatsLoading(false);
    },
    // authExpired sengaja tidak masuk deps - identik dengan versi asli AdminPanel
    // (menambahkannya akan me-reset interval polling tiap render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, chartPeriod, tokenDays, setCategoryData],
  );

  useEffect(() => {
    if (tokenStats && typeof tokenStats.budget === "number") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBudgetInput(String(tokenStats.budget));
    }
  }, [tokenStats?.budget]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
    const t = setInterval(fetchStats, 15000);
    return () => clearInterval(t);
  }, [isAuthenticated, fetchStats]);

  // Rate live (RPM/TPM/RPD): refresh 10 detik, independen dari stats utama.
  const [rateStats, setRateStats] = useState<{ rpd: number; rpm: number; tpm: number } | null>(
    null,
  );
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    const load = () => {
      fetchApi<{ rpd: number; rpm: number; tpm: number }>("/api/python/admin/rate-stats")
        .then((j) => {
          if (alive) setRateStats(j);
        })
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  const saveTokenBudget = async () => {
    const v = Math.max(0, parseInt(budgetInput || "0", 10) || 0);
    try {
      const j = await fetchApi<{ budget?: number }>("/api/python/admin/token-budget", {
        method: "PUT",
        json: { daily_token_budget: v },
      });
      setTokenStats((t: TokenUsageStats | null) =>
        t
          ? {
              ...t,
              budget: j.budget,
              remaining: j.budget ? j.budget - (t.today?.total || 0) : null,
            }
          : t,
      );
      pushToast(
        "success",
        "Budget token disimpan",
        v > 0 ? `${v.toLocaleString()} token/hari` : "Tanpa batas harian",
      );
    } catch (e) {
      // HTTP gagal -> "Coba lagi."; koneksi gagal -> "Server tidak merespons."
      if (!(e instanceof ApiError) || e.status > 0) {
        pushToast("error", "Gagal simpan budget", "Coba lagi.");
      } else {
        pushToast("error", "Gagal simpan budget", "Server tidak merespons.");
      }
    }
  };

  return {
    realStats,
    setRealStats,
    tokenStats,
    setTokenStats,
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
  };
}

export type AdminTokensApi = ReturnType<typeof useAdminTokens>;
