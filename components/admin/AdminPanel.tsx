"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  User,
  BookOpen,
  Sliders,
  MessageSquare,
  FileText,
  Save,
  Plus,
  Trash2,
  LogOut,
  Check,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Upload,
  Download,
  Copy,
  FileJson,
  X,
  Activity,
  TrendingUp,
  Database,
  Zap,
  Clock,
  BarChart3,
  Brain,
  Lightbulb,
  Fingerprint,
  Target,
  ScrollText,
  Layers,
  History,
  GraduationCap,
  Briefcase,
  Rocket,
  Heart,
  MapPin,
  Settings2,
  Palette,
  Gauge,
  Mic2,
  Type,
  PenTool,
  Layers3,
  Wrench,
  Blocks,
  ShieldCheck,
  GitBranch,
  KeyRound,
  Cog,
  FileCode,
  Cpu,
  Globe,
  Hash,
  Box,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

type TabType = "dashboard" | "users" | "identity" | "personal" | "knowledge" | "personality" | "communication" | "instructions" | "models";

type RealStats = {
  totalRequests: number; totalUsers: number; activeUsers: number; disabledUsers: number;
  knowledgeEntries: number; totalPromptsUsed: number; trialTotalUsed: number;
  exhausted: number; unlimitedUsers: number; avgPrompts: number;
  uptime: string; uptimeSeconds: number;
  knowledgeByCategory: { name: string; value: number }[];
  topPrompts: { username: string; prompts_used: number; max_prompts: number }[];
  dailyRequests: { day: string; count: number }[];
  dailyLatency: { day: string; avg_ms: number | null; models: { model: string; avg_ms: number; count: number }[] }[];
  periodMeta?: { period: string; limit: number };
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

type ToastKind = "success" | "error" | "info";
type Toast = { id: string; kind: ToastKind; title: string; desc?: string };

/* ---- design tokens ---- */
const cardBase = "rounded-xl border border-white/[0.07] bg-zinc-900/40 backdrop-blur";
const cardHeaderCls = "px-5 pt-5 pb-3";
const cardContentCls = "p-5 pt-0";
const cardFooterCls = "p-5 pt-0";
const rowCls = "px-5 py-4";

/* typography scale — enlarged +4px vs original, hierarchy preserved */
const tPage = "text-[26px] font-semibold tracking-tight text-white leading-none";
const tSub = "text-[18px] font-semibold tracking-tight text-zinc-100";
const tCard = "text-[15px] font-semibold tracking-[0.08em] uppercase text-zinc-300";
const tLabel = "text-[14px] font-medium tracking-[0.06em] text-zinc-400 uppercase";
const tBody = "text-[16px] leading-relaxed text-zinc-300";
const tSmall = "text-[15px] leading-relaxed text-zinc-500";
const tMono = "font-mono text-[15px]";
const tStat = "mt-1.5 text-[28px] font-semibold tracking-tight text-white leading-none tabular-nums";
const tValue = "text-[16px] font-semibold tabular-nums text-zinc-200";

/* identity colors */
const cUser = "text-sky-300";
const cModel = "text-violet-300";
const cName = "text-white";
const cRole = "text-sky-400";
const cSky = "text-sky-400";
const cViolet = "text-violet-400";
const cAmber = "text-amber-400";
const cEmerald = "text-emerald-400";
const cRose = "text-rose-400";
const cZinc = "text-zinc-500";

const inputCls = "h-9 border-white/10 bg-zinc-900 text-white placeholder:text-zinc-500 text-[16px]";
const textareaCls = "border-white/10 bg-zinc-900 text-white placeholder:text-zinc-500 text-[16px] leading-relaxed";
const sectionHeaderWrap = "border-b border-white/[0.06] pb-4";
const sectionDescCls = "mt-1.5 text-[16px] leading-relaxed text-zinc-500";

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={sectionHeaderWrap}>
      <h2 className={tPage}>{title}</h2>
      <p className={sectionDescCls}>{desc}</p>
    </div>
  );
}

export default function AdminPanel({ initialTab = "dashboard" as TabType }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const url = tab === "dashboard" ? "/admin/dashboard" : `/admin/${tab}`;
    try { window.history.pushState(null, "", url); } catch {}
  };

  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = React.useCallback((kind: ToastKind, title: string, desc?: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, kind, title, desc }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);
  const dismissToast = React.useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);

  const [identityData, setIdentityData] = useState({ name: "", role: "", description: "", identity: "", purpose: "" });
  const [personalData, setPersonalData] = useState({ profile: "", background: "", interests: "", experience: "", projects: "", preferences: "", relevant_context: "" });
  const [personalityData, setPersonalityData] = useState({ personality: "", tone: "", attitude: "", reasoning_style: "", criticism_style: "", response_behavior: "", prohibited_behavior: "" });
  const [commData, setCommData] = useState({ primary_language: "", tone: "", response_length: "", formatting_preference: "", technical_depth: "", explanation_style: "" });
  const [sysData, setSysData] = useState({ behavioral_rules: "", response_rules: "", safety_rules: "", knowledge_priority: "", reasoning_constraints: "", formatting_rules: "" });

  const [modelConfig, setModelConfig] = useState({
    active_model: "",
    fallback_models: [] as string[],
    provider: "openrouter",
    api_base_url: "https://openrouter.ai/api/v1",
    temperature: 0.4,
    reasoning_enabled: false,
  });
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [fallbackInput, setFallbackInput] = useState("");
  const [catalogApiKey, setCatalogApiKey] = useState("");
  const [catalogBaseUrl, setCatalogBaseUrl] = useState("");
  const [showCatalogKey, setShowCatalogKey] = useState(false);
  const [modelTestResults, setModelTestResults] = useState<Record<string, { status: "ok" | "error" | "loading"; latency_ms?: number; sample?: string; error?: string }>>({});

  const [knowledgeCategories, setKnowledgeCategories] = useState<any[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<any[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("technical_knowledge");
  const [newEntryModal, setNewEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ id: "", title: "", content: "", category_id: "" });

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [appSettings, setAppSettings] = useState<{ user_token_expiry_hours: number; trial_prompts: number }>({ user_token_expiry_hours: 24, trial_prompts: 3 });
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", display_name: "", max_prompts: 50, is_active: true });
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonDrag, setJsonDrag] = useState(false);
  const jsonFileRef = React.useRef<HTMLInputElement>(null);

  const [realStats, setRealStats] = useState<RealStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month" | "year">("day");
  const fetchStats = React.useCallback(async (period?: string) => {
    if (!isAuthenticated) return;
    setStatsLoading(true);
    try {
      const p = (period || chartPeriod) as string;
      const qs = p !== "day" ? `?period=${p}&limit=${p === "day" ? 14 : p === "week" ? 12 : p === "month" ? 12 : 6}` : "";
      const res = await fetch(`/api/python/admin/stats${qs}`);
      if (authExpired(res.status)) return;
      if (res.ok) {
        const j = await res.json();
        setRealStats(j);
        if (Array.isArray(j.knowledgeByCategory) && j.knowledgeByCategory.length) {
          setCategoryData(j.knowledgeByCategory);
        }
      }
    } catch {}
    setStatsLoading(false);
  }, [isAuthenticated, chartPeriod]);
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();
    const t = setInterval(fetchStats, 15000);
    return () => clearInterval(t);
  }, [isAuthenticated, fetchStats]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/python/admin/verify");
      if (res.ok) {
        setIsAuthenticated(true);
        loadAllData();
        loadUsersAndSettings();
      } else {
        router.replace("/admin/login");
      }
    } catch {}
    setIsLoadingAuth(false);
  };

  // Cookie admin (itz_admin_token) expire tiap 2h. Kalau panel dibiarkan
  // terbuka lewat expiry, semua save balik 401 "No token provided".
  // Guard ini redirect ke login alih-alih menampilkan error membingungkan.
  const authExpired = (status: number): boolean => {
    if (status === 401) {
      pushToast("error", "Sesi admin berakhir", "Silakan login ulang");
      router.replace("/admin/login");
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    try { await fetch("/api/python/admin/logout", { method: "POST" }); } catch {}
    router.replace("/admin/login");
  };

  const loadUsersAndSettings = async () => {
    setUsersLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([fetch("/api/python/admin/users"), fetch("/api/python/admin/settings")]);
      if (uRes.ok) setUsers(await uRes.json());
      if (sRes.ok) { const j = await sRes.json(); const s = j.settings || j; setAppSettings({ user_token_expiry_hours: Number(s.user_token_expiry_hours ?? 24), trial_prompts: Number(s.trial_prompts ?? 3) }); }
    } catch {}
    setUsersLoading(false);
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = Boolean(editingUserId);
    const url = isEdit ? `/api/python/admin/users/${editingUserId}` : "/api/python/admin/users";
    const method = isEdit ? "PUT" : "POST";
    const body: any = isEdit
      ? { display_name: userForm.display_name || null, max_prompts: Number(userForm.max_prompts), is_active: userForm.is_active, ...(userForm.password ? { password: userForm.password } : {}) }
      : { username: userForm.username.trim().toLowerCase(), password: userForm.password, display_name: userForm.display_name || null, max_prompts: Number(userForm.max_prompts), is_active: userForm.is_active };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (authExpired(res.status)) return;
    if (!res.ok) { const j = await res.json().catch(() => ({})); pushToast("error", "Gagal simpan user", (j.detail || JSON.stringify(j)).slice(0, 140)); return; }
    pushToast("success", isEdit ? "User diperbarui" : "User dibuat");
    setUserModalOpen(false); setEditingUserId(null); setUserForm({ username: "", password: "", display_name: "", max_prompts: 50, is_active: true });
    loadUsersAndSettings();
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Hapus user ini?")) return;
    const res = await fetch(`/api/python/admin/users/${id}`, { method: "DELETE" });
    if (authExpired(res.status)) return;
    if (!res.ok) { pushToast("error", "Gagal hapus user"); return; }
    pushToast("success", "User dihapus"); loadUsersAndSettings();
  };

  const handleResetUsage = async (id: string) => {
    const res = await fetch(`/api/python/admin/users/${id}/reset-usage`, { method: "POST" });
    if (authExpired(res.status)) return;
    if (!res.ok) { pushToast("error", "Gagal reset"); return; }
    pushToast("success", "Usage direset"); loadUsersAndSettings();
  };

  const handleSaveSettings = async () => {
    const res = await fetch("/api/python/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_token_expiry_hours: Number(appSettings.user_token_expiry_hours), trial_prompts: Number(appSettings.trial_prompts) }) });
    if (authExpired(res.status)) return;
    if (!res.ok) { const j = await res.json().catch(() => ({})); const msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || j); pushToast("error", "Gagal simpan", msg.slice(0, 120)); return; }
    const j = await res.json(); const s = j.settings || j; setAppSettings({ user_token_expiry_hours: Number(s.user_token_expiry_hours ?? 24), trial_prompts: Number(s.trial_prompts ?? 3) }); pushToast("success", "Pengaturan disimpan");
  };

  const loadAllData = async () => {
    try {
      const [idRes, perRes, persRes, commRes, sysRes, catRes, entRes, modelRes] = await Promise.all([
        fetch("/api/python/admin/config/ai_identity"),
        fetch("/api/python/admin/config/personal_information"),
        fetch("/api/python/admin/config/ai_personality"),
        fetch("/api/python/admin/config/communication_settings"),
        fetch("/api/python/admin/config/system_instructions"),
        fetch("/api/python/admin/knowledge/categories"),
        fetch("/api/python/admin/knowledge/entries"),
        fetch("/api/python/admin/models"),
      ]);

      if (idRes.ok) setIdentityData(await idRes.json());
      if (perRes.ok) setPersonalData(await perRes.json());
      if (persRes.ok) setPersonalityData(await persRes.json());
      if (commRes.ok) setCommData(await commRes.json());
      if (sysRes.ok) setSysData(await sysRes.json());
      if (catRes.ok) {
        const cats = await catRes.json();
        setKnowledgeCategories(cats);
        if (entRes.ok) {
          const entries = await entRes.json();
          setKnowledgeEntries(entries);
          const catCounts: Record<string, number> = {};
          entries.forEach((e: any) => {
            const cat = cats.find((c: any) => c.id === e.category_id);
            if (cat) catCounts[cat.name] = (catCounts[cat.name] || 0) + 1;
          });
          setCategoryData(Object.entries(catCounts).map(([name, value]) => ({ name, value })));
        }
      }
      if (modelRes.ok) {
        const m = await modelRes.json();
        const cur = m.current || m;
        setModelConfig({
          active_model: cur.active_model || "",
          fallback_models: (cur.fallback_models || []).map((s: any) => String(s)),
          provider: cur.provider || "openrouter",
          api_base_url: cur.api_base_url || "https://openrouter.ai/api/v1",
          temperature: Number(cur.temperature ?? 0.4),
          reasoning_enabled: Boolean(cur.reasoning_enabled),
        });
        const cat = m.live_catalog?.data || m.live_catalog?.fallback?.data || [];
        if (Array.isArray(cat) && cat.length) setAvailableModels(cat);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  };

  const refreshAvailableModels = async (opts?: { freeOnly?: boolean }) => {
    setModelsLoading(true);
    try {
      const fo = opts?.freeOnly ?? freeOnly;
      let data: any = null;
      if (catalogApiKey.trim() || catalogBaseUrl.trim()) {
        const res = await fetch("/api/python/admin/models/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: catalogApiKey.trim() || undefined, base_url: catalogBaseUrl.trim() || undefined, include_free_only: fo, limit: 120 }),
        });
        if (res.ok) {
          const j = await res.json();
          if (Array.isArray(j.data) && j.data.length) { setAvailableModels(j.data); data = j.data; }
          if (j.error) pushToast("error", "Katalog gagal", String(j.error).slice(0, 160));
        } else {
          const j = await res.json().catch(() => ({}));
          const msg = (j as any).detail || (j as any).error || "Katalog gagal";
          pushToast("error", "Katalog gagal", typeof msg === "string" ? msg.slice(0, 160) : JSON.stringify(msg).slice(0, 160));
        }
      } else {
        const params = new URLSearchParams({ include_free_only: String(fo), limit: "120" });
        const res = await fetch(`/api/python/admin/models?${params.toString()}`);
        if (res.ok) {
          const j = await res.json();
          data = j.live_catalog?.data || j.live_catalog?.fallback?.data || j.data || null;
          if (Array.isArray(data)) setAvailableModels(data);
          if (j.live_catalog?.error) pushToast("error", "Katalog gagal", String(j.live_catalog.error).slice(0, 160));
        }
        if (!data || !Array.isArray(data) || data.length === 0) {
          const res2 = await fetch(`/api/python/v1/models/available?limit=120&include_free_only=${fo}`);
          if (res2.ok) {
            const j2 = await res2.json();
            if (Array.isArray(j2.data) && j2.data.length) setAvailableModels(j2.data);
            else if (Array.isArray(j2.fallback?.data)) setAvailableModels(j2.fallback.data);
          }
        }
      }
    } catch (e) {
      console.error("refreshAvailableModels error:", e);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleTestModel = async (modelId: string) => {
    const id = modelId.trim();
    if (!id) return;
    setModelTestResults((prev) => ({ ...prev, [id]: { status: "loading" } }));
    try {
      const body: any = { model: id };
      if (catalogApiKey.trim()) body.api_key = catalogApiKey.trim();
      if (catalogBaseUrl.trim()) body.base_url = catalogBaseUrl.trim();
      if (modelConfig.provider) body.provider = modelConfig.provider;
      const res = await fetch("/api/python/admin/models/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.status === "ok") {
        setModelTestResults((prev) => ({ ...prev, [id]: { status: "ok", latency_ms: j.latency_ms, sample: j.sample } }));
        pushToast("success", "Model OK", `${id.slice(0, 40)} · ${j.latency_ms}ms`);
      } else {
        const err = (j.detail?.error || j.detail || j.error || "Gagal") as string;
        const latency = j.detail?.latency_ms ?? j.latency_ms;
        setModelTestResults((prev) => ({ ...prev, [id]: { status: "error", latency_ms: latency, error: typeof err === "string" ? err : JSON.stringify(err) } }));
        pushToast("error", "Model gagal", typeof err === "string" ? err.slice(0, 160) : "Cek kredensial / model");
      }
    } catch (e: any) {
      setModelTestResults((prev) => ({ ...prev, [id]: { status: "error", error: e.message || String(e) } }));
      pushToast("error", "Model gagal", (e.message || String(e)).slice(0, 160));
    }
  };

  const handleSaveModelConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");
    try {
      const res = await fetch("/api/python/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_model: modelConfig.active_model,
          fallback_models: modelConfig.fallback_models,
          provider: modelConfig.provider,
          api_base_url: modelConfig.api_base_url,
          temperature: modelConfig.temperature,
          reasoning_enabled: modelConfig.reasoning_enabled,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        const cur = j.data || j.current || modelConfig;
        setModelConfig((prev) => ({ ...prev, ...cur }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        pushToast("success", "Model diperbarui", (cur.active_model || modelConfig.active_model || "").slice(0, 80));
      } else {
        if (authExpired(res.status)) return;
        const d = await res.json().catch(() => ({}));
        const msg = (d as any).detail || "Gagal menyimpan model config";
        setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
        pushToast("error", "Gagal simpan model", typeof msg === "string" ? msg.slice(0, 120) : "Periksa input.");
      }
    } catch (err: any) {
      const msg = err.message || "Error saving model config";
      setErrorMessage(msg);
      pushToast("error", "Gagal simpan model", msg.slice(0, 120));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async (section: TabType) => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");
    let payloadData = {};
    if (section === "identity") payloadData = identityData;
    else if (section === "personal") payloadData = personalData;
    else if (section === "personality") payloadData = personalityData;
    else if (section === "communication") payloadData = commData;
    else if (section === "instructions") payloadData = sysData;
    const tableMap: Record<string, string> = {
      identity: "ai_identity",
      personal: "personal_information",
      personality: "ai_personality",
      communication: "communication_settings",
      instructions: "system_instructions"
    };
    const labelMap: Record<string, string> = {
      identity: "Identitas",
      personal: "Info Personal",
      personality: "Kepribadian",
      communication: "Komunikasi",
      instructions: "Instruksi",
    };
    try {
      const res = await fetch("/api/python/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: tableMap[section], data: payloadData }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        pushToast("success", "Tersimpan", `${labelMap[section] ?? section} diperbarui.`);
      } else {
        if (authExpired(res.status)) return;
        const d = await res.json().catch(() => ({}));
        const msg = (d as any).detail || "Gagal menyimpan konfigurasi";
        const str = typeof msg === "string" ? msg : JSON.stringify(msg);
        setErrorMessage(str);
        pushToast("error", "Gagal simpan", str.slice(0, 120));
      }
    } catch (err: any) {
      const msg = err.message || "Error saving configuration";
      setErrorMessage(msg);
      pushToast("error", "Gagal simpan", msg.slice(0, 120));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKnowledgeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = knowledgeCategories.find(c => c.slug === selectedCategorySlug);
    if (!cat) return;
    try {
      const res = await fetch("/api/python/admin/knowledge/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entryForm.id || undefined,
          category_id: cat.id,
          title: entryForm.title,
          content: entryForm.content,
          is_active: true
        }),
      });
      if (res.ok) {
        setNewEntryModal(false);
        setEntryForm({ id: "", title: "", content: "", category_id: "" });
        loadAllData();
        pushToast("success", "Knowledge ditambah", entryForm.title.slice(0, 60));
      } else {
        if (authExpired(res.status)) return;
        const d = await res.json().catch(() => ({}));
        const msg = (d as any).detail || "Gagal simpan knowledge";
        pushToast("error", "Gagal simpan", typeof msg === "string" ? msg.slice(0, 120) : "Cek input.");
      }
    } catch (err: any) {
      pushToast("error", "Gagal simpan", err.message?.slice(0, 120) || "Error");
    }
  };

  const handleDeleteKnowledgeEntry = async (id: string) => {
    if (!confirm("Hapus entri knowledge ini?")) return;
    try {
      const res = await fetch(`/api/python/admin/knowledge/entries/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadAllData();
        pushToast("success", "Terhapus", "Entri knowledge dihapus.");
      } else {
        const d = await res.json().catch(() => ({}));
        pushToast("error", "Gagal hapus", (d as any).detail?.slice?.(0, 120) || "Coba lagi.");
      }
    } catch (err: any) {
      pushToast("error", "Gagal hapus", err.message?.slice(0, 120) || "Error");
    }
  };

  const buildLocalExportBlob = () => {
    const exportObj: any = {
      version: 1,
      exported_at: new Date().toISOString(),
      ai_identity: identityData,
      personal_information: personalData,
      ai_personality: personalityData,
      communication_settings: commData,
      system_instructions: sysData,
      knowledge_entries: knowledgeEntries.map((e: any) => ({
        id: e.id,
        category_slug: (knowledgeCategories.find((c) => c.id === e.category_id)?.slug) || e.category_slug || undefined,
        category_id: e.category_id,
        title: e.title,
        content: e.content,
        tags: e.tags || [],
        is_active: e.is_active ?? true,
      })),
    };
    return new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
  };

  const handleBulkExport = async () => {
    try {
      const res = await fetch("/api/python/admin/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `itz-ai-admin-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {}
    const blob = buildLocalExportBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itz-ai-admin-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleBulkDownloadExample = async () => {
    try {
      const res = await fetch("/data/admin_bulk_example.json");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "admin_bulk_example.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {}
    const blob = buildLocalExportBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin_bulk_example.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const applyImportedDataToState = (data: any) => {
    if (data.ai_identity) setIdentityData((prev) => ({ ...prev, ...data.ai_identity }));
    if (data.personal_information) setPersonalData((prev) => ({ ...prev, ...data.personal_information }));
    if (data.ai_personality) setPersonalityData((prev) => ({ ...prev, ...data.ai_personality }));
    if (data.communication_settings) setCommData((prev) => ({ ...prev, ...data.communication_settings }));
    if (data.system_instructions) setSysData((prev) => ({ ...prev, ...data.system_instructions }));
  };

  const handleJsonApplyFromText = async () => {
    setJsonError("");
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch (e: any) {
      const msg = `Invalid JSON: ${e.message || String(e)}`;
      setJsonError(msg);
      pushToast("error", "JSON tidak valid", msg.slice(0, 120));
      return;
    }
    applyImportedDataToState(data);
    setSaving(true);
    try {
      const res = await fetch("/api/python/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = (j as any).detail || (j as any).message || JSON.stringify(j);
        const str = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
        setJsonError(str);
        setSaveSuccess(false);
        pushToast("error", "Import gagal", str.slice(0, 120));
      } else {
        const j = await res.json().catch(() => ({}));
        if ((j as any).errors) {
          const errStr = JSON.stringify((j as any).errors, null, 2);
          setJsonError(`Partial import — some sections failed:\n${errStr}`);
          pushToast("info", "Import sebagian", "Beberapa section gagal — cek detail.");
        } else {
          pushToast("success", "Import berhasil", `${((j as any).applied_sections || []).length} section + ${(j as any).knowledge_entries_applied || 0} knowledge diterapkan.`);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadAllData();
        setTimeout(() => setShowJsonModal(false), 700);
      }
    } catch (e: any) {
      const msg = e.message || String(e);
      setJsonError(msg);
      pushToast("error", "Import gagal", msg.slice(0, 120));
    } finally {
      setSaving(false);
    }
  };

  const handleJsonFile = async (file: File) => {
    setJsonError("");
    try {
      const text = await file.text();
      setJsonText(text);
      const data = JSON.parse(text);
      applyImportedDataToState(data);
    } catch (e: any) {
      setJsonError(e.message || String(e));
    }
  };

  const openJsonModalWithPrefill = async () => {
    try {
      const res = await fetch("/api/python/admin/export");
      if (res.ok) {
        const j = await res.json();
        setJsonText(JSON.stringify(j, null, 2));
        setJsonError("");
        setShowJsonModal(true);
        return;
      }
    } catch {}
    setJsonText(JSON.stringify(JSON.parse(new TextDecoder().decode(new TextEncoder().encode(JSON.stringify({
      ai_identity: identityData,
      personal_information: personalData,
      ai_personality: personalityData,
      communication_settings: commData,
      system_instructions: sysData,
      knowledge_entries: knowledgeEntries.slice(0, 50).map((e: any) => ({
        category_slug: (knowledgeCategories.find((c) => c.id === e.category_id)?.slug) || undefined,
        title: e.title,
        content: e.content,
        tags: e.tags || [],
        is_active: e.is_active ?? true,
      })),
    })))), null, 2));
    setJsonError("");
    setShowJsonModal(true);
  };

  const ToastStack = (
    <div aria-live="polite" aria-atomic={false} className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[92vw] max-w-[380px] flex-col gap-2 sm:right-4 sm:top-4">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const isSuccess = t.kind === "success";
          const isError = t.kind === "error";
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 16, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto flex gap-3 rounded-xl border px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl ${isSuccess ? "border-emerald-500/20 bg-[#07140e]/95" : isError ? "border-red-500/20 bg-[#1a0a0a]/95" : "border-white/[0.08] bg-zinc-900/95"}`}
            >
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isSuccess ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-400" : isError ? "border-red-500/20 bg-red-500/15 text-red-400" : "border-white/10 bg-white/[0.06] text-zinc-300"}`} aria-hidden>
                {isSuccess ? <Check className="h-3.5 w-3.5" /> : isError ? <AlertCircle className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[16px] font-medium leading-none ${isSuccess ? "text-emerald-200" : isError ? "text-red-200" : "text-zinc-100"}`}>{t.title}</p>
                {t.desc && <p className={`mt-1.5 text-[14px] leading-[1.5] break-words ${isSuccess ? "text-emerald-200/60" : isError ? "text-red-200/60" : "text-zinc-400"}`}>{t.desc}</p>}
              </div>
              <button type="button" onClick={() => dismissToast(t.id)} aria-label="Tutup notifikasi" className="pointer-events-auto -mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black relative overflow-hidden">
        {ToastStack}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_800px_400px_at_50%_-10%,rgba(255,255,255,0.05),transparent_60%)]" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900">
            <img src="/image/favicon.png" alt="" width={44} height={44} className="h-full w-full object-cover opacity-90" />
          </div>
          <div className="flex items-center gap-2 text-[16px] tracking-wide text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span>Memeriksa sesi…</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        {ToastStack}
        <div className="flex items-center gap-2 text-[16px] text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Mengalihkan ke login…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden relative selection:bg-white selection:text-black">
      {ToastStack}

      {/* Sidebar */}
      <aside className="hidden w-[272px] shrink-0 flex-col justify-between border-r border-white/[0.07] bg-[#050507] p-5 md:flex relative z-10">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8 flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black">
              <img src="/image/favicon.png" alt="ITZ" width={40} height={40} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold tracking-[0.08em] text-white">ITZ AI</h1>
              <p className="text-[13px] font-medium tracking-[0.14em] text-zinc-500">CONSOLE</p>
            </div>
          </motion.div>

          <nav className="space-y-1" aria-label="Navigasi admin">
            {[
              { id: "dashboard", label: "Dashboard", icon: BarChart3 },
              { id: "users", label: "Users", icon: User },
              { id: "models", label: "AI Models", icon: Sparkles },
              { id: "identity", label: "Identity", icon: Fingerprint },
              { id: "personal", label: "Personal Info", icon: User },
              { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
              { id: "personality", label: "Personality", icon: Brain },
              { id: "communication", label: "Communication", icon: MessageSquare },
              { id: "instructions", label: "Instructions", icon: FileText },
            ].map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    onClick={() => switchTab(item.id as TabType)}
                    className={`w-full justify-start gap-2.5 text-[16px] font-medium h-9 transition-colors cursor-pointer ${
                      isActive
                        ? "bg-white text-black shadow-sm border border-white"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <Icon className="h-[15px] w-[15px] shrink-0" />
                    <span>{item.label}</span>
                  </Button>
                </motion.div>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-4">
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />} className="w-full justify-start gap-2.5 text-[16px] font-medium h-9 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Chat</span>
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-2.5 text-[16px] font-medium h-9 text-zinc-500 hover:text-red-300 hover:bg-red-500/10 cursor-pointer">
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 relative z-10">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className={sectionHeaderWrap}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className={tPage}>Dashboard</h2>
                    <p className={sectionDescCls}>Data real dari Supabase / storage lokal · refresh 15s</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[13px] font-medium tracking-[0.06em] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                      LIVE
                    </span>
                    <Button variant="outline" size="sm" onClick={() => fetchStats()} disabled={statsLoading} className="h-8 border-white/10 bg-white/[0.04] text-[14px] text-zinc-300 gap-1.5">
                      {statsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />} Refresh
                    </Button>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[13px] font-medium tracking-wide text-zinc-400">v2.1</span>
                  </div>
                </div>
              </div>

              {!realStats ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[1,2,3,4].map((i) => (
                    <Card key={i} className={cardBase}><CardContent className="p-5"><div className="h-14 animate-pulse rounded-lg bg-white/5" /></CardContent></Card>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "Total Requests", value: realStats.totalRequests.toLocaleString(), sub: `${realStats.totalPromptsUsed} user + ${realStats.trialTotalUsed} trial`, icon: TrendingUp, iconBg: "bg-emerald-500/10 border-emerald-500/15", iconColor: "text-emerald-400" },
                      { label: "Users", value: `${realStats.activeUsers}/${realStats.totalUsers}`, sub: `${realStats.disabledUsers} nonaktif · ${realStats.exhausted} quota habis`, icon: User, iconBg: "bg-sky-500/10 border-sky-500/15", iconColor: "text-sky-400" },
                      { label: "Avg Prompts / User", value: String(realStats.avgPrompts), sub: `${realStats.unlimitedUsers} unlimited`, icon: Zap, iconBg: "bg-amber-500/10 border-amber-500/15", iconColor: "text-amber-400" },
                      { label: "Knowledge", value: String(realStats.knowledgeEntries), sub: `${realStats.knowledgeByCategory.length} kategori`, icon: Database, iconBg: "bg-violet-500/10 border-violet-500/15", iconColor: "text-violet-400" },
                    ].map((stat, idx) => {
                      const Icon = stat.icon;
                      return (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                          <Card className={cardBase}>
                            <CardContent className="flex items-center justify-between gap-3 p-5">
                              <div className="min-w-0">
                                <p className={tLabel}>{stat.label}</p>
                                <p className={tStat}>{stat.value}</p>
                                <p className="mt-1 text-[13px] leading-none text-zinc-500 truncate">{stat.sub}</p>
                              </div>
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${stat.iconBg}`} aria-hidden><Icon className={`h-4 w-4 ${stat.iconColor}`} /></span>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { k: "Uptime", v: realStats.uptime },
                      { k: "Trial Used", v: String(realStats.trialTotalUsed) },
                      { k: "Quota Habis", v: String(realStats.exhausted) },
                      { k: "Unlimited", v: String(realStats.unlimitedUsers) },
                    ].map((m) => (
                      <Card key={m.k} className={cardBase}>
                        <CardContent className="flex items-baseline justify-between gap-2 px-5 py-4">
                          <span className={tLabel}>{m.k}</span>
                          <span className={tValue}>{m.v}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className={cardBase}>
                      <CardHeader className={cardHeaderCls}>
                        <CardTitle className={tCard}>
                          <span className="flex items-center justify-between gap-2 w-full">
                            <span className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-emerald-400" /> Ready — Katalog</span>
                            <Badge variant="outline" className="border-white/10 bg-white/[0.06] text-zinc-300 font-mono text-[13px] tabular-nums">{availableModels.length} model</Badge>
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className={cardContentCls}>
                        {availableModels.length === 0 ? (
                          <p className={tBody}>Belum load katalog. Buka tab AI Models → isi Kredensial Katalog → Muat ulang.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-auto pr-1">
                            {availableModels.slice(0, 24).map((m: any) => (
                              <span key={m.id} className="inline-flex max-w-[220px] truncate rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[13px] font-medium text-zinc-300" title={m.id}>{m.name ? `${m.name} — ${m.id}` : m.id}</span>
                            ))}
                            {availableModels.length > 24 && <span className="text-[13px] text-zinc-500">+{availableModels.length - 24} lagi</span>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className={cardBase}>
                      <CardHeader className={cardHeaderCls}>
                        <CardTitle className={tCard}>
                          <span className="flex items-center justify-between gap-2 w-full">
                            <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-amber-400" /> Fallback Chain</span>
                            <Badge variant="outline" className="border-white/10 bg-white/[0.06] text-zinc-300 font-mono text-[13px] tabular-nums">{modelConfig.fallback_models.length} model</Badge>
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
                                <span key={mid} className={`inline-flex max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[13px] font-medium ${isActive ? "border-white/15 bg-white/10 text-zinc-200" : "border-white/10 bg-white/[0.06] text-zinc-300"}`} title={mid}>{mid}</span>
                              );
                            })}
                          </div>
                        )}
                        <p className="mt-3 text-[13px] text-zinc-500">Aktif: <span className="font-mono text-zinc-300">{modelConfig.active_model || "—"}</span></p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className={cardBase}>
                      <CardHeader className={cardHeaderCls}><CardTitle className={`${tCard} flex items-center gap-2`}><Database className="h-3.5 w-3.5 text-violet-400" /> Knowledge by Category</CardTitle></CardHeader>
                      <CardContent className={cardContentCls}>
                        {categoryData.length === 0 ? (
                          <div className="py-16 text-center text-[16px] text-zinc-500">Belum ada knowledge.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} outerRadius={90} dataKey="value">
                                {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    <Card className={cardBase}>
                      <CardHeader className={cardHeaderCls}><CardTitle className={`${tCard} flex items-center gap-2`}><BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Top Prompts by User</CardTitle></CardHeader>
                      <CardContent className={cardContentCls}>
                        {!realStats.topPrompts || realStats.topPrompts.length === 0 ? (
                          <div className="py-16 text-center text-[16px] text-zinc-500">Belum ada usage.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={realStats.topPrompts} layout="vertical" margin={{ left: 12, right: 16 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.08} />
                              <XAxis type="number" stroke="#71717a" fontSize={11} fontFamily="monospace" />
                              <YAxis type="category" dataKey="username" stroke="#a1a1aa" fontSize={11} width={90} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                              <Bar dataKey="prompts_used" fill="#34d399" radius={[0, 8, 8, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card className={cardBase}>
                      <CardHeader className={cardHeaderCls}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className={`${tCard} flex items-center gap-2`}><Activity className="h-3.5 w-3.5 text-sky-400" /> Total Requests</CardTitle>
                          <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[13px]">
                            {(["day","week","month","year"] as const).map((p) => (
                              <button key={p} onClick={() => { setChartPeriod(p); fetchStats(p); }} className={`rounded-full px-2.5 py-1 capitalize transition ${chartPeriod === p ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}>{p === "day" ? "Day" : p === "week" ? "Week" : p === "month" ? "Month" : "Year"}</button>
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className={cardContentCls}>
                        {!realStats.dailyRequests || realStats.dailyRequests.length === 0 ? (
                          <div className="py-16 text-center text-[16px] text-zinc-500">Belum ada data.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={realStats.dailyRequests.map((d: any) => {
                              const lab = String(d.day);
                              const short = chartPeriod === "month" ? lab : chartPeriod === "year" ? lab : lab.slice(5);
                              return { day: short, count: d.count, full: lab };
                            })}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.08} />
                              <XAxis dataKey="day" stroke="#71717a" fontSize={11} fontFamily="monospace" interval={0} />
                              <YAxis stroke="#71717a" fontSize={11} fontFamily="monospace" allowDecimals={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '12px' }} labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.full || _} />
                              <Bar dataKey="count" fill="#38bdf8" radius={[6,6,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card className={cardBase}>
                      <CardHeader className={cardHeaderCls}><CardTitle className={`${tCard} flex items-center gap-2`}><Clock className="h-3.5 w-3.5 text-amber-400" /> Response Time Rata2 Models (ms)</CardTitle></CardHeader>
                      <CardContent className={cardContentCls}>
                        {!realStats.dailyLatency || realStats.dailyLatency.every((d: any) => d.avg_ms == null) ? (
                          <div className="py-16 text-center text-[16px] text-zinc-500">Belum ada latency — chat dulu untuk isi data.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={realStats.dailyLatency.map((d: any) => {
                              const lab = String(d.day);
                              const short = chartPeriod === "month" ? lab : chartPeriod === "year" ? lab : lab.slice(5);
                              return { day: short, avg_ms: d.avg_ms, full: lab };
                            })}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.08} />
                              <XAxis dataKey="day" stroke="#71717a" fontSize={11} fontFamily="monospace" interval={0} />
                              <YAxis stroke="#71717a" fontSize={11} fontFamily="monospace" />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', fontSize: '12px' }} formatter={(v: any) => [`${v} ms`, 'avg']} labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.full || _} />
                              <Line type="monotone" dataKey="avg_ms" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                        {realStats.dailyLatency && (() => {
                          const agg: Record<string, { sum: number; cnt: number }> = {};
                          realStats.dailyLatency.forEach((d: any) => (d.models || []).forEach((m: any) => {
                            const k = m.model || "unknown";
                            if (!agg[k]) agg[k] = { sum: 0, cnt: 0 };
                            agg[k].sum += (m.avg_ms || 0) * (m.count || 1);
                            agg[k].cnt += (m.count || 1);
                          }));
                          const rows = Object.entries(agg).map(([model, v]) => ({ model, avg_ms: Math.round(v.sum / Math.max(1, v.cnt)), count: v.cnt })).sort((a,b) => a.avg_ms - b.avg_ms).slice(0, 6);
                          const label = chartPeriod === "day" ? "14 hari" : chartPeriod === "week" ? "12 minggu" : chartPeriod === "month" ? "12 bulan" : "6 tahun";
                          return rows.length ? (
                            <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
                              <p className="text-[13px] font-medium tracking-[0.06em] text-zinc-500 uppercase">Rata-rata per model ({label})</p>
                              {rows.map((r) => (
                                <div key={r.model} className="flex items-center justify-between gap-2 text-[16px]">
                                  <span className="truncate font-mono text-zinc-300 text-[14px]" title={r.model}>{r.model}</span>
                                  <span className="shrink-0 tabular-nums text-zinc-400 text-[14px]">{r.avg_ms} ms · {r.count}x</span>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className={cardBase}>
                    <CardHeader className={cardHeaderCls}><CardTitle className={`${tCard} flex items-center gap-2`}><Activity className="h-3.5 w-3.5 text-emerald-400" /> System</CardTitle></CardHeader>
                    <CardContent className={cardContentCls}>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <span className={tLabel}>Uptime</span>
                          <span className="text-[16px] font-medium tracking-tight text-zinc-200 tabular-nums">{realStats.uptime} · ONLINE</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <span className={tLabel}>API</span><span className="text-[16px] font-medium tracking-tight text-zinc-200">READY · LIVE</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                          <span className={tLabel}>Model</span><span className="text-[16px] font-medium text-zinc-200 truncate max-w-[160px] tabular-nums">{modelConfig.active_model.split('/')[1]?.slice(0, 22) || '—'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Users" desc="Kelola akun pengguna, batas prompt, dan pengaturan akses." />

              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}><CardTitle className={tCard}>Pengaturan</CardTitle></CardHeader>
                <CardContent className={`${cardContentCls} flex flex-wrap items-end gap-4`}>
                  <div className="space-y-2">
                    <Label className={tLabel}>Expiry token user (jam)</Label>
                    <Input type="number" min={1} max={720} value={appSettings.user_token_expiry_hours} onChange={(e) => setAppSettings((p) => ({ ...p, user_token_expiry_hours: Number(e.target.value) }))} className={`${inputCls} w-32`} />
                  </div>
                  <div className="space-y-2">
                    <Label className={tLabel}>Trial prompts (0=matikan trial)</Label>
                    <Input type="number" min={0} max={100} value={appSettings.trial_prompts} onChange={(e) => setAppSettings((p) => ({ ...p, trial_prompts: Number(e.target.value) }))} className={`${inputCls} w-32`} />
                  </div>
                  <Button onClick={handleSaveSettings} className="h-9 bg-white text-black hover:bg-zinc-100 gap-1.5 text-[16px] font-medium"><Save className="h-4 w-4" /> Simpan</Button>
                  <p className="text-[13px] leading-relaxed text-zinc-500 w-full">Expiry berlaku untuk login baru. Trial per IP, hit ke-{appSettings.trial_prompts + 1} wajib login.</p>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <h3 className={tSub}>Daftar Pengguna</h3>
                <Button onClick={() => { setEditingUserId(null); setUserForm({ username: "", password: "", display_name: "", max_prompts: 50, is_active: true }); setUserModalOpen(true); }} className="h-9 bg-white text-black hover:bg-zinc-100 gap-1.5 text-[16px] font-medium"><Plus className="h-4 w-4" /> Tambah User</Button>
              </div>

              <Card className={`${cardBase} overflow-hidden`}>
                <CardContent className="p-0">
                  {usersLoading ? <div className="p-6 text-[16px] text-zinc-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div> : users.length === 0 ? <div className="p-6 text-[16px] text-zinc-500">Belum ada user.</div> : (
                    <div className="divide-y divide-white/[0.06]">
                      {users.map((u: any) => {
                        const remaining = Number(u.max_prompts) === 0 ? Infinity : Math.max(0, Number(u.max_prompts) - Number(u.prompts_used || 0));
                        const exhausted = Number(u.max_prompts) > 0 && Number(u.prompts_used || 0) >= Number(u.max_prompts);
                        return (
                          <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[16px] font-medium ${cUser}`}>{u.username}</span>
                                {u.display_name && <span className="text-[16px] text-zinc-500">— {u.display_name}</span>}
                                {!u.is_active && <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-red-300">NONAKTIF</span>}
                                {exhausted && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-300">HABIS — hubungi admin</span>}
                              </div>
                              <div className="mt-1 text-[13px] text-zinc-500 tabular-nums">Dipakai {u.prompts_used || 0} / {Number(u.max_prompts) === 0 ? "∞" : u.max_prompts} {remaining !== Infinity && `· sisa ${remaining}`}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleResetUsage(u.id)} className="h-8 border-white/10 text-[14px]">Reset</Button>
                              <Button variant="outline" size="sm" onClick={() => { setEditingUserId(u.id); setUserForm({ username: u.username, password: "", display_name: u.display_name || "", max_prompts: Number(u.max_prompts), is_active: Boolean(u.is_active) }); setUserModalOpen(true); }} className="h-8 border-white/10 text-[14px]">Edit</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} className="h-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {userModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setUserModalOpen(false)}>
                  <Card className="w-full max-w-md border-white/10 bg-zinc-900 rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <CardHeader className={cardHeaderCls}><CardTitle className="text-[14px] font-semibold tracking-[0.08em] uppercase text-white">{editingUserId ? "Edit User" : "Tambah User"}</CardTitle></CardHeader>
                    <CardContent className="p-5 pt-0">
                      <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                        {!editingUserId && <div className="space-y-2"><Label className={tLabel}>Username</Label><Input value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} required minLength={3} maxLength={32} placeholder="johndoe" className={inputCls} /></div>}
                        <div className="space-y-2"><Label className={tLabel}>{editingUserId ? "Password baru (kosongkan jika tidak ganti)" : "Password"}</Label><Input type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} required={!editingUserId} minLength={6} className={inputCls} /></div>
                        <div className="space-y-2"><Label className={tLabel}>Display name</Label><Input value={userForm.display_name} onChange={(e) => setUserForm((p) => ({ ...p, display_name: e.target.value }))} className={inputCls} /></div>
                        <div className="space-y-2"><Label className={tLabel}>Batas prompt (0 = unlimited)</Label><Input type="number" min={0} max={100000} value={userForm.max_prompts} onChange={(e) => setUserForm((p) => ({ ...p, max_prompts: Number(e.target.value) }))} className={inputCls} /></div>
                        <label className="flex items-center gap-2 text-[16px] text-zinc-300"><input type="checkbox" checked={userForm.is_active} onChange={(e) => setUserForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded" /> Aktif</label>
                        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setUserModalOpen(false)} className="h-9 text-[16px]">Batal</Button><Button type="submit" className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px]">Simpan</Button></div>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          )}

          {/* Bulk JSON toolbar */}
          {activeTab !== "models" && activeTab !== "dashboard" && activeTab !== "users" && (
            <Card className={cardBase}>
              <CardContent className="flex flex-wrap items-center gap-2 p-5">
                <span className="flex items-center gap-2 text-[14px] font-medium tracking-[0.06em] text-zinc-400 uppercase">
                  <FileJson className="h-4 w-4" />
                  Bulk JSON
                </span>
                <Button variant="outline" size="sm" onClick={openJsonModalWithPrefill} className="h-8 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-[16px] gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import JSON</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkExport} className="h-8 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-[16px] gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  <span>Export JSON</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleBulkDownloadExample} className="h-8 text-zinc-500 hover:text-zinc-200 text-[16px]">
                  Contoh format
                </Button>
              </CardContent>
            </Card>
          )}

          {/* MODELS */}
          {activeTab === "models" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Model AI" desc="Model yang sedang dipakai ditampilkan pertama. Pilih dari katalog live atau ketik ID model apa pun." />

              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={`${tCard} flex items-center gap-2`}><Sparkles className="h-3.5 w-3.5 text-violet-400" />Model yang sedang dipakai</CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} space-y-2`}>
                  <p className={`break-all text-[16px] font-medium leading-relaxed ${cModel}`}>{modelConfig.active_model || "— belum dimuat —"}</p>
                  <p className="text-[16px] leading-relaxed text-zinc-500">
                    provider: <span className="text-zinc-300">{modelConfig.provider}</span> · base: <span className="break-all text-zinc-300">{modelConfig.api_base_url}</span>
                  </p>
                  <p className="text-[13px] leading-relaxed text-zinc-500">
                    Fallback: {modelConfig.fallback_models.length ? modelConfig.fallback_models.join(", ") : "— tidak ada —"} · temp: {modelConfig.temperature} · reasoning: {modelConfig.reasoning_enabled ? "aktif" : "nonaktif"}
                  </p>
                </CardContent>
              </Card>

              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={tCard}>Konfigurasi Model</CardTitle>
                  <CardDescription className="text-[16px] leading-relaxed text-zinc-500">Atur model aktif, provider, dan fallback chain</CardDescription>
                </CardHeader>
                <CardContent className={`${cardContentCls} grid gap-4`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-zinc-500" />ID model aktif</span></Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestModel(modelConfig.active_model)}
                        disabled={!modelConfig.active_model.trim() || modelTestResults[modelConfig.active_model]?.status === "loading"}
                        className="h-7 border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-zinc-300 gap-1"
                      >
                        {modelTestResults[modelConfig.active_model]?.status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Test
                      </Button>
                    </div>
                    {modelTestResults[modelConfig.active_model] && modelTestResults[modelConfig.active_model].status !== "loading" && (
                      <div className={`rounded-lg border px-3 py-2 text-[13px] ${modelTestResults[modelConfig.active_model].status === "ok" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
                        {modelTestResults[modelConfig.active_model].status === "ok" ? `OK · ${modelTestResults[modelConfig.active_model].latency_ms}ms` : `Gagal · ${modelTestResults[modelConfig.active_model].error?.slice(0,120)}`}
                        {modelTestResults[modelConfig.active_model].sample ? ` · "${modelTestResults[modelConfig.active_model].sample}"` : ""}
                      </div>
                    )}
                    <Input
                      list="admin-model-options"
                      value={modelConfig.active_model}
                      onChange={(e) => setModelConfig({ ...modelConfig, active_model: e.target.value })}
                      placeholder="cth. qwen/qwen3.8-27b:free"
                      className={inputCls}
                    />
                    <datalist id="admin-model-options">
                      {availableModels
                        .filter((m) => {
                          if (!modelSearch) return true;
                          const q = modelSearch.toLowerCase();
                          return (m.id || "").toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q);
                        })
                        .slice(0, 60)
                        .map((m) => (
                          <option key={m.id} value={m.id}>{m.name || m.id}</option>
                        ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Box className="h-3.5 w-3.5 text-zinc-500" />Provider</span></Label>
                      <Input value={modelConfig.provider} onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })} placeholder="openrouter" className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-zinc-500" />API base URL</span></Label>
                      <Input value={modelConfig.api_base_url} onChange={(e) => setModelConfig({ ...modelConfig, api_base_url: e.target.value })} placeholder="https://openrouter.ai/api/v1" className={inputCls} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-zinc-500" />Temperature (0–2)</span></Label>
                      <Input type="number" min={0} max={2} step={0.1} value={modelConfig.temperature} onChange={(e) => setModelConfig({ ...modelConfig, temperature: Number(e.target.value) || 0 })} className={inputCls} />
                    </div>
                    <Label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[16px] font-normal text-zinc-300">
                      <Checkbox checked={modelConfig.reasoning_enabled} onCheckedChange={(checked) => setModelConfig({ ...modelConfig, reasoning_enabled: Boolean(checked) })} />
                      <span className="flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-zinc-500" />Reasoning aktif</span>
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className={tLabel}><span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-zinc-500" />Model fallback</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {modelConfig.fallback_models.map((mid) => (
                        <Badge key={mid} variant="secondary" className="gap-2 py-1.5 text-[14px] bg-white/10 text-zinc-300 border border-white/10">
                          {mid}
                          <button type="button" onClick={() => setModelConfig({ ...modelConfig, fallback_models: modelConfig.fallback_models.filter((x) => x !== mid) })} className="ml-1 rounded-full bg-white/10 text-zinc-300 px-1.5 py-0.5 text-[13px] hover:bg-red-500/20 hover:text-red-300 border border-white/10" title="Hapus fallback">✕</button>
                        </Badge>
                      ))}
                      {modelConfig.fallback_models.length === 0 && <span className="text-[16px] text-zinc-500">Belum ada fallback</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input value={fallbackInput} onChange={(e) => setFallbackInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = fallbackInput.trim(); if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] }); setFallbackInput(""); }}} placeholder="Ketik ID model lalu Enter" className={`${inputCls} flex-1`} />
                      <Button type="button" onClick={() => { const v = fallbackInput.trim(); if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] }); setFallbackInput(""); }} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] gap-1.5">
                        <Plus className="h-4 w-4" /> Tambah
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-end p-5 pt-0">
                  <Button onClick={handleSaveModelConfig} disabled={saving || !modelConfig.active_model.trim()} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi Model"}</span>
                  </Button>
                </CardFooter>
              </Card>

              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className={tCard}>Katalog model live</CardTitle>
                        <CardDescription className="text-[16px] leading-relaxed text-zinc-500">Sumber: katalog provider · API key & base URL katalog terpisah dari model aktif</CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="flex cursor-pointer items-center gap-2 text-[14px] font-normal text-zinc-400">
                          <Checkbox checked={freeOnly} onCheckedChange={(checked) => { setFreeOnly(Boolean(checked)); refreshAvailableModels({ freeOnly: Boolean(checked) }); }} />
                          Hanya gratis
                        </Label>
                        <Button variant="outline" size="sm" onClick={() => refreshAvailableModels()} disabled={modelsLoading} className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px]">
                          {modelsLoading ? "Memuat..." : "Muat ulang"}
                        </Button>
                        <Input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Cari model..." className="h-8 w-40 border-white/10 bg-white/[0.04] text-white text-[16px]" />
                      </div>
                    </div>
                    <div className="grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-[13px] font-medium tracking-[0.06em] text-zinc-400 uppercase flex items-center gap-1.5"><KeyRound className="h-3 w-3" /> API Key Katalog (preview saja, tidak disimpan)</Label>
                        <div className="flex gap-1.5">
                          <Input type={showCatalogKey ? "text" : "password"} value={catalogApiKey} onChange={(e) => setCatalogApiKey(e.target.value)} placeholder="sk-... (kosong = pakai env/server)" className={`${inputCls} h-8`} />
                          <Button variant="ghost" size="icon" onClick={() => setShowCatalogKey((v) => !v)} className="h-8 w-8 shrink-0 text-zinc-400" type="button">{showCatalogKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px] font-medium tracking-[0.06em] text-zinc-400 uppercase flex items-center gap-1.5"><Globe className="h-3 w-3" /> Base URL Katalog</Label>
                        <Input value={catalogBaseUrl} onChange={(e) => setCatalogBaseUrl(e.target.value)} placeholder="https://api.groq.com/openai/v1 (kosong = default)" className={`${inputCls} h-8`} />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[28rem] overflow-y-auto rounded-b-xl border-t border-white/[0.07]">
                    {availableModels.length === 0 ? (
                      <div className="p-6 text-center text-[16px] text-zinc-500">
                        {modelsLoading ? "Memuat katalog..." : "Tidak ada model. Cek API key atau tekan Muat ulang."}
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/[0.06]">
                        {availableModels
                          .filter((m) => {
                            if (!modelSearch) return true;
                            const q = modelSearch.toLowerCase();
                            return (m.id || "").toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q);
                          })
                          .slice(0, 120)
                          .map((m) => {
                            const isActive = m.id === modelConfig.active_model;
                            return (
                              <li key={m.id} className={`flex items-start justify-between gap-3 px-5 py-4 ${isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`font-mono text-[14px] font-medium ${isActive ? "text-emerald-300" : cModel}`}>{m.id}</span>
                                    {isActive && <Badge className="bg-white text-black text-[10px]">AKTIF</Badge>}
                                    {m.pricing && (m.pricing.prompt === "0" || String(m.pricing.prompt) === "0.0000000") && <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px]">GRATIS</Badge>}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-zinc-500">{m.name || m.description || ""}</div>
                                  {m.context_length ? <div className="text-[13px] text-zinc-500">context: {Number(m.context_length).toLocaleString("id-ID")}</div> : null}
                                </div>
                                <div className="flex shrink-0 flex-col gap-1.5">
                                  <Button variant={isActive ? "secondary" : "default"} size="sm" onClick={() => setModelConfig({ ...modelConfig, active_model: m.id })} className={`h-7 text-[14px] ${isActive ? "bg-zinc-800 text-zinc-200" : "bg-white text-black hover:bg-zinc-100"}`}>{isActive ? "Aktif" : "Pakai"}</Button>
                                  <Button variant="outline" size="sm" onClick={() => { if (!modelConfig.fallback_models.includes(m.id)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, m.id] }); }} disabled={modelConfig.fallback_models.includes(m.id) || isActive} className="h-7 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px]">+ Fallback</Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestModel(m.id)}
                                    disabled={modelTestResults[m.id]?.status === "loading"}
                                    className={`h-7 text-[13px] ${modelTestResults[m.id]?.status === "ok" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : modelTestResults[m.id]?.status === "error" ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}
                                  >
                                    {modelTestResults[m.id]?.status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : modelTestResults[m.id]?.status === "ok" ? `OK ${modelTestResults[m.id]?.latency_ms}ms` : modelTestResults[m.id]?.status === "error" ? "Gagal" : "Test"}
                                  </Button>
                                  {modelTestResults[m.id]?.error && <span className="max-w-[140px] truncate text-[13px] text-red-300/70" title={modelTestResults[m.id]?.error}>{modelTestResults[m.id]?.error}</span>}
                                  {modelTestResults[m.id]?.sample && <span className="max-w-[140px] truncate text-[13px] text-emerald-300/70">“{modelTestResults[m.id]?.sample}”</span>}
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* IDENTITY */}
          {activeTab === "identity" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Identitas AI" desc="Menentukan identitas dasar, nama, peran, dan tujuan ITZ AI." />
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={tCard}>Identitas</CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} grid gap-4`}>
                  <div className="space-y-2">
                    <Label className={tLabel}><span className="flex items-center gap-1.5"><Fingerprint className={`h-3.5 w-3.5 ${cSky}`} />Nama AI</span></Label>
                    <Input value={identityData.name} onChange={(e) => setIdentityData({ ...identityData, name: e.target.value })} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label className={tLabel}><span className="flex items-center gap-1.5"><Briefcase className={`h-3.5 w-3.5 ${cViolet}`} />Peran</span></Label>
                    <Input value={identityData.role} onChange={(e) => setIdentityData({ ...identityData, role: e.target.value })} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label className={tLabel}><span className="flex items-center gap-1.5"><ScrollText className={`h-3.5 w-3.5 ${cAmber}`} />Deskripsi</span></Label>
                    <Textarea rows={2} value={identityData.description} onChange={(e) => setIdentityData({ ...identityData, description: e.target.value })} className={textareaCls} />
                  </div>
                  <div className="space-y-2">
                    <Label className={tLabel}><span className="flex items-center gap-1.5"><Brain className={`h-3.5 w-3.5 ${cEmerald}`} />Pernyataan Identitas</span></Label>
                    <Textarea rows={3} value={identityData.identity} onChange={(e) => setIdentityData({ ...identityData, identity: e.target.value })} className={textareaCls} />
                  </div>
                  <div className="space-y-2">
                    <Label className={tLabel}><span className="flex items-center gap-1.5"><Target className={`h-3.5 w-3.5 ${cRose}`} />Tujuan</span></Label>
                    <Textarea rows={3} value={identityData.purpose} onChange={(e) => setIdentityData({ ...identityData, purpose: e.target.value })} className={textareaCls} />
                  </div>
                </CardContent>
                <CardFooter className="justify-end p-5 pt-0">
                  <Button onClick={() => handleSaveConfig("identity")} disabled={saving} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* PERSONAL */}
          {activeTab === "personal" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Informasi Personal" desc="Informasi mengenai owner yang dipakai sebagai konteks AI." />
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={tCard}>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} grid gap-4`}>
                  {[
                    { key: "profile", label: "Profil", Icon: User, color: cSky },
                    { key: "background", label: "Latar Belakang", Icon: History, color: cAmber },
                    { key: "interests", label: "Minat", Icon: Heart, color: cRose },
                    { key: "experience", label: "Pengalaman", Icon: Briefcase, color: cViolet },
                    { key: "projects", label: "Proyek", Icon: Rocket, color: cEmerald },
                    { key: "preferences", label: "Preferensi", Icon: Settings2, color: cZinc },
                    { key: "relevant_context", label: "Konteks Relevan", Icon: MapPin, color: cSky },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Ico className={`h-3.5 w-3.5 ${item.color}`} />{item.label}</span></Label>
                      <Textarea rows={2} value={(personalData as any)[item.key] || ""} onChange={(e) => setPersonalData({ ...personalData, [item.key]: e.target.value })} className={textareaCls} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end p-5 pt-0">
                  <Button onClick={() => handleSaveConfig("personal")} disabled={saving} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* KNOWLEDGE */}
          {activeTab === "knowledge" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Basis Pengetahuan" desc="Pengetahuan owner terstruktur dan persisten dengan pencarian embedding semantik." />
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className={tCard}>Knowledge Entries</CardTitle>
                    <Button onClick={() => { setEntryForm({ id: "", title: "", content: "", category_id: "" }); setNewEntryModal(true); }} className="h-8 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                      <Plus className="h-4 w-4" />
                      <span>Tambah Knowledge</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className={`${cardContentCls} space-y-4`}>
                  <div className="flex flex-wrap gap-2">
                    {knowledgeCategories.map((cat) => (
                      <Button key={cat.id} variant={selectedCategorySlug === cat.slug ? "default" : "outline"} size="sm" onClick={() => setSelectedCategorySlug(cat.slug)} className={`h-8 text-[14px] ${selectedCategorySlug === cat.slug ? "bg-white text-black hover:bg-zinc-100 border border-white" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"}`}>
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {knowledgeEntries
                      .filter((e) => {
                        const cat = knowledgeCategories.find((c) => c.id === e.category_id);
                        return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
                      })
                      .map((entry) => (
                        <Card key={entry.id} className="rounded-xl border border-white/[0.07] bg-zinc-900/60">
                          <CardContent className="flex items-start justify-between gap-3 p-4">
                            <div className="space-y-1 min-w-0">
                              <h4 className="text-[16px] font-medium text-zinc-200 leading-relaxed">{entry.title}</h4>
                              <p className="line-clamp-2 text-[14px] leading-relaxed text-zinc-500">{entry.content}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteKnowledgeEntry(entry.id)} className="shrink-0 h-8 w-8 text-zinc-500 hover:text-red-300 hover:bg-red-500/10" title="Hapus entri">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    {knowledgeEntries.filter((e) => {
                      const cat = knowledgeCategories.find((c) => c.id === e.category_id);
                      return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
                    }).length === 0 && (
                      <Card className="border-dashed border-white/10 bg-zinc-900/40 rounded-xl">
                        <CardContent className="p-8 text-center text-[16px] text-zinc-500">
                          Belum ada knowledge pada kategori ini. Klik "Tambah Knowledge" untuk membuat entri baru.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PERSONALITY */}
          {activeTab === "personality" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Kepribadian" desc="Menentukan karakter, nada, sikap, dan batasan perilaku AI." />
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={tCard}>Personality</CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} grid gap-4`}>
                  {[
                    { key: "personality", label: "Kepribadian", Icon: Brain, color: cViolet },
                    { key: "tone", label: "Nada", Icon: Mic2, color: cSky },
                    { key: "attitude", label: "Sikap", Icon: Heart, color: cRose },
                    { key: "reasoning_style", label: "Gaya Penalaran", Icon: Lightbulb, color: cAmber },
                    { key: "criticism_style", label: "Gaya Kritik", Icon: MessageSquare, color: cSky },
                    { key: "response_behavior", label: "Perilaku Respons", Icon: Zap, color: cAmber },
                    { key: "prohibited_behavior", label: "Perilaku Terlarang", Icon: ShieldCheck, color: cEmerald },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Ico className={`h-3.5 w-3.5 ${item.color}`} />{item.label}</span></Label>
                      <Textarea rows={2} value={(personalityData as any)[item.key] || ""} onChange={(e) => setPersonalityData({ ...personalityData, [item.key]: e.target.value })} className={textareaCls} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end p-5 pt-0">
                  <Button onClick={() => handleSaveConfig("personality")} disabled={saving} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* COMMUNICATION */}
          {activeTab === "communication" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Gaya Komunikasi" desc="Pengaturan bahasa, panjang respons, format, dan kedalaman teknis." />
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={tCard}>Communication</CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} grid gap-4`}>
                  {[
                    { key: "primary_language", label: "Bahasa Utama", Icon: Globe, color: cSky },
                    { key: "tone", label: "Nada", Icon: Mic2, color: cRose },
                    { key: "response_length", label: "Panjang Respons", Icon: Type, color: cZinc },
                    { key: "formatting_preference", label: "Preferensi Format", Icon: Palette, color: cViolet },
                    { key: "technical_depth", label: "Kedalaman Teknis", Icon: Gauge, color: cAmber },
                    { key: "explanation_style", label: "Gaya Penjelasan", Icon: PenTool, color: cEmerald },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Ico className={`h-3.5 w-3.5 ${item.color}`} />{item.label}</span></Label>
                      <Input value={(commData as any)[item.key] || ""} onChange={(e) => setCommData({ ...commData, [item.key]: e.target.value })} className={inputCls} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end p-5 pt-0">
                  <Button onClick={() => handleSaveConfig("communication")} disabled={saving} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <SectionHeader title="Instruksi Sistem" desc="Layer dengan prioritas tertinggi untuk behavioral rules, safety rules, dan knowledge priority." />
              <Card className={cardBase}>
                <CardHeader className={cardHeaderCls}>
                  <CardTitle className={tCard}>System Instructions</CardTitle>
                </CardHeader>
                <CardContent className={`${cardContentCls} grid gap-4`}>
                  {[
                    { key: "behavioral_rules", label: "Behavioral Rules", Icon: Cog, color: cZinc },
                    { key: "response_rules", label: "Response Rules", Icon: ScrollText, color: cAmber },
                    { key: "safety_rules", label: "Safety Rules", Icon: ShieldCheck, color: cEmerald },
                    { key: "knowledge_priority", label: "Knowledge Priority", Icon: Layers3, color: cViolet },
                    { key: "reasoning_constraints", label: "Reasoning Constraints", Icon: GitBranch, color: cSky },
                    { key: "formatting_rules", label: "Formatting Rules", Icon: FileCode, color: cRose },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className={tLabel}><span className="flex items-center gap-1.5"><Ico className={`h-3.5 w-3.5 ${item.color}`} />{item.label}</span></Label>
                      <Textarea rows={2} value={(sysData as any)[item.key] || ""} onChange={(e) => setSysData({ ...sysData, [item.key]: e.target.value })} className={textareaCls} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end p-5 pt-0">
                  <Button onClick={() => handleSaveConfig("instructions")} disabled={saving} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5">
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

        </div>
      </main>

      {/* New Knowledge Entry Modal */}
      <Dialog open={newEntryModal} onOpenChange={setNewEntryModal}>
        <DialogContent className="border-white/10 bg-zinc-900 text-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold tracking-[0.08em] uppercase text-white">Tambah Knowledge Baru</DialogTitle>
            <DialogDescription className="text-[16px] leading-relaxed text-zinc-500">Buat entri pengetahuan baru yang akan di-embedding dan dipakai sebagai konteks AI.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveKnowledgeEntry} className="space-y-4">
            <div className="space-y-2">
              <Label className={tLabel}>Judul / Topik</Label>
              <Input value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} required placeholder="Misal: Arsitektur Backend ITZ AI" className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label className={tLabel}>Kategori</Label>
              <Select value={selectedCategorySlug} onValueChange={(v) => setSelectedCategorySlug(v ?? selectedCategorySlug)}>
                <SelectTrigger className="border-white/10 bg-zinc-800 text-white text-[16px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-zinc-900 text-white">
                  {knowledgeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={tLabel}>Konten Pengetahuan</Label>
              <Textarea rows={5} value={entryForm.content} onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })} required placeholder="Tuliskan pengetahuan detail yang akan diserap oleh AI..." className={textareaCls} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setNewEntryModal(false)} className="h-9 border-white/10 bg-white/[0.04] text-zinc-300 text-[16px]">Batal</Button>
            <Button onClick={(e: any) => handleSaveKnowledgeEntry(e)} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium">Simpan &amp; Generate Embedding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk JSON Import/Export Modal */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col p-0 border-white/10 bg-zinc-900 text-white rounded-xl overflow-hidden">
          <DialogHeader className="border-b border-white/[0.07] p-6 pb-4 px-5 pt-5">
            <DialogTitle className="text-[14px] font-semibold tracking-[0.08em] uppercase text-white">Import JSON</DialogTitle>
            <DialogDescription className="text-[16px] leading-relaxed text-zinc-500">Tempel JSON atau upload file untuk mengisi konfigurasi admin.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 border-b border-white/[0.07] p-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <div
              onDragOver={(e) => { e.preventDefault(); setJsonDrag(true); }}
              onDragLeave={() => setJsonDrag(false)}
              onDrop={(e) => { e.preventDefault(); setJsonDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void handleJsonFile(f); }}
              className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-[16px] ${jsonDrag ? "border-white/20 bg-white/[0.06] text-white" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>{jsonDrag ? "Lepaskan file..." : "Drag & drop .json atau"}</span>
              <Button variant="link" size="sm" type="button" onClick={() => jsonFileRef.current?.click()} className="h-auto p-0 text-[16px] underline text-zinc-400">pilih file</Button>
              <Input ref={jsonFileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleJsonFile(f); e.target.value = ""; }} />
            </div>
            <Button variant="outline" size="sm" onClick={handleBulkDownloadExample} className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px] gap-1.5">
              <FileJson className="h-3.5 w-3.5" /> Example
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([jsonText || "{}"], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "admin-config.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px] gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> .json
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(jsonText || ""); } catch {} }} className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px] gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {jsonError && (
              <Alert variant="destructive" className="mb-3 border-red-500/30 bg-red-500/10">
                <AlertCircle className="text-red-400 h-4 w-4" />
                <AlertTitle className="text-red-300 text-[16px]">JSON error</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap text-red-200/70 text-[14px] leading-relaxed">{jsonError}</AlertDescription>
              </Alert>
            )}
            <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={18} spellCheck={false} placeholder='{"ai_identity": {...}, ...}' className="text-[14px] leading-relaxed border-white/10 bg-white/[0.03] text-white font-mono" />
          </div>

          <DialogFooter className="border-t border-white/[0.07] p-5">
            <Button variant="outline" onClick={() => setShowJsonModal(false)} className="h-9 border-white/10 bg-white/[0.04] text-zinc-300 text-[16px]">Batal</Button>
            <Button variant="outline" onClick={() => { try { applyImportedDataToState(JSON.parse(jsonText)); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); } catch (e: any) { setJsonError(`Invalid JSON: ${e.message}`); } }} className="h-9 border-white/10 bg-white/[0.04] text-zinc-300 text-[16px]">Isi form saja</Button>
            <Button onClick={handleJsonApplyFromText} disabled={saving || !jsonText.trim()} className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium">{saving ? "Mengimpor..." : "Validasi & Import"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
