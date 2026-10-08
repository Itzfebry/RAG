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
} from "lucide-react";
import Link from "next/link";
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
import { motion } from "framer-motion";

type TabType = "dashboard" | "identity" | "personal" | "knowledge" | "personality" | "communication" | "instructions" | "models";

// Mock real-time data generator with more professional metrics
const generateMockStats = () => ({
  totalRequests: Math.floor(Math.random() * 5000) + 15000,
  activeUsers: Math.floor(Math.random() * 150) + 250,
  avgResponseTime: (Math.random() * 0.8 + 0.2).toFixed(3),
  knowledgeEntries: Math.floor(Math.random() * 50) + 420,
  uptime: "99.97%",
  errorRate: (Math.random() * 0.5).toFixed(2),
  tokensProcessed: Math.floor(Math.random() * 1000000) + 5000000,
  cacheHitRate: (Math.random() * 15 + 85).toFixed(1),
});

const generateTimeSeriesData = () => {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now - (23 - i) * 3600000).getHours().toString().padStart(2, '0') + ":00",
    requests: Math.floor(Math.random() * 200) + 500,
    errors: Math.floor(Math.random() * 15) + 2,
    responseTime: (Math.random() * 0.5 + 0.3).toFixed(3),
    cpu: Math.floor(Math.random() * 30) + 40,
    memory: Math.floor(Math.random() * 20) + 60,
  }));
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Real-time stats
  const [stats, setStats] = useState(generateMockStats());
  const [timeSeriesData, setTimeSeriesData] = useState(generateTimeSeriesData());
  const [categoryData, setCategoryData] = useState([
    { name: 'Technical', value: 45 },
    { name: 'Projects', value: 25 },
    { name: 'Personal', value: 20 },
    { name: 'Other', value: 10 },
  ]);

  // Config states
  const [identityData, setIdentityData] = useState({ name: "", role: "", description: "", identity: "", purpose: "" });
  const [personalData, setPersonalData] = useState({ profile: "", background: "", interests: "", experience: "", projects: "", preferences: "", relevant_context: "" });
  const [personalityData, setPersonalityData] = useState({ personality: "", tone: "", attitude: "", reasoning_style: "", criticism_style: "", response_behavior: "", prohibited_behavior: "" });
  const [commData, setCommData] = useState({ primary_language: "", tone: "", response_length: "", formatting_preference: "", technical_depth: "", explanation_style: "" });
  const [sysData, setSysData] = useState({ behavioral_rules: "", response_rules: "", safety_rules: "", knowledge_priority: "", reasoning_constraints: "", formatting_rules: "" });

  // Model config states
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

  // Knowledge states
  const [knowledgeCategories, setKnowledgeCategories] = useState<any[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<any[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("technical_knowledge");
  const [newEntryModal, setNewEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ id: "", title: "", content: "", category_id: "" });

  // Bulk JSON import/export
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonDrag, setJsonDrag] = useState(false);
  const jsonFileRef = React.useRef<HTMLInputElement>(null);

  // Real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      setStats(generateMockStats());
      setTimeSeriesData(generateTimeSeriesData());
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/python/admin/verify");
      if (res.ok) {
        setIsAuthenticated(true);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/python/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        loadAllData();
      } else {
        const data = await res.json();
        setAuthError(data.detail || "Login gagal");
      }
    } catch (err) {
      setAuthError("Gagal terhubung ke server auth");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/python/admin/logout", { method: "POST" });
    setIsAuthenticated(false);
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
          
          // Update category distribution
          const catCounts: Record<string, number> = {};
          entries.forEach((e: any) => {
            const cat = cats.find((c: any) => c.id === e.category_id);
            if (cat) {
              catCounts[cat.name] = (catCounts[cat.name] || 0) + 1;
            }
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
      const res = await fetch(`/api/python/admin/models?include_free_only=${fo}&limit=120`);
      let data: any = null;
      if (res.ok) {
        const j = await res.json();
        data = j.live_catalog?.data || j.live_catalog?.fallback?.data || j.data || null;
        if (Array.isArray(data)) setAvailableModels(data);
      }
      if (!data || !Array.isArray(availableModels) || availableModels.length === 0) {
        const res2 = await fetch(`/api/python/v1/models/available?limit=120&include_free_only=${fo}`);
        if (res2.ok) {
          const j2 = await res2.json();
          if (Array.isArray(j2.data) && j2.data.length) setAvailableModels(j2.data);
          else if (Array.isArray(j2.fallback?.data)) setAvailableModels(j2.fallback.data);
        }
      }
    } catch (e) {
      console.error("refreshAvailableModels error:", e);
    } finally {
      setModelsLoading(false);
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
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMessage((d as any).detail || "Gagal menyimpan model config");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error saving model config");
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

    try {
      const res = await fetch("/api/python/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: tableMap[section], data: payloadData }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const d = await res.json();
        setErrorMessage(d.detail || "Gagal menyimpan konfigurasi");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error saving configuration");
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
      }
    } catch (err) {
      console.error("Error saving knowledge entry:", err);
    }
  };

  const handleDeleteKnowledgeEntry = async (id: string) => {
    if (!confirm("Hapus entri knowledge ini?")) return;
    try {
      await fetch(`/api/python/admin/knowledge/entries/${id}`, { method: "DELETE" });
      loadAllData();
    } catch (err) {
      console.error("Error deleting entry:", err);
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
      setJsonError(`Invalid JSON: ${e.message || String(e)}`);
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
        setJsonError(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
        setSaveSuccess(false);
      } else {
        const j = await res.json().catch(() => ({}));
        if ((j as any).errors) setJsonError(`Partial import — some sections failed:\n${JSON.stringify((j as any).errors, null, 2)}`);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadAllData();
        setTimeout(() => setShowJsonModal(false), 700);
      }
    } catch (e: any) {
      setJsonError(e.message || String(e));
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

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#05030a]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3"
        >
          <Sparkles className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="text-zinc-300">Memeriksa otorisasi admin...</span>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-md border-slate-800/50 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border-2 border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-lg shadow-white/5">
                <Shield className="h-8 w-8 text-zinc-400" />
              </div>
              <CardTitle className="mt-6 text-2xl text-slate-100 font-bold">Admin Control Panel</CardTitle>
              <CardDescription className="text-slate-400">Secure access to system administration</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-username" className="text-slate-300 text-sm font-medium">Username</Label>
                  <Input 
                    id="admin-username" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    required 
                    className="border-white/10 bg-zinc-800/50 text-white focus:border-white/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-slate-300 text-sm font-medium">Password</Label>
                  <Input 
                    id="admin-password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    placeholder="••••••••••••"
                    className="border-white/10 bg-zinc-800/50 text-white focus:border-white/20"
                  />
                </div>
                {authError && (
                  <Alert variant="destructive" className="border-red-500/20 bg-red-500/10">
                    <AlertCircle />
                    <AlertTitle className="text-red-300">Authentication Failed</AlertTitle>
                    <AlertDescription className="text-red-200/70">{authError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200 text-white font-semibold">
                  Sign In to Dashboard
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center">
              <Button variant="link" size="sm" nativeButton={false} render={<Link href="/" />} className="text-slate-400 hover:text-slate-200">
                ← Back to Chat
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      
      {/* Sidebar */}
      <aside className="hidden w-72 flex-col justify-between border-r border-white/[0.06] bg-black/60 backdrop-blur-xl p-6 md:flex relative z-10">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8 flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 shadow-lg">
              <img src="/image/favicon.png" alt="ITZ" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">ITZ AI CONTROL</h1>
              <p className="text-[10px] text-zinc-500 uppercase ">ADMIN PANEL</p>
            </div>
          </motion.div>

          <nav className="space-y-1">
            {[
              { id: "dashboard", label: "Dashboard", icon: BarChart3 },
              { id: "models", label: "AI Models", icon: Sparkles },
              { id: "identity", label: "Identity", icon: Sparkles },
              { id: "personal", label: "Personal Info", icon: User },
              { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
              { id: "personality", label: "Personality", icon: Sliders },
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
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={`w-full justify-start gap-3 text-[13px] font-medium transition-all duration-200 ${
                      isActive 
                        ? `bg-white text-black shadow-lg border border-white/10` 
                        : "text-zinc-500 hover:text-white hover:bg-white/[0.05] border border-transparent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </motion.div>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 border-t border-white/[0.06] pt-4">
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />} className="w-full justify-start gap-2 text-zinc-500 hover:text-white hover:bg-white/[0.05]">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Chat</span>
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10 relative z-10">
        <div className="mx-auto max-w-7xl space-y-6">
          
          {/* Feedback banner */}
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Alert className="border-white/[0.06] bg-zinc-800/60 backdrop-blur">
                <Check className="text-zinc-300" />
                <AlertTitle className="text-emerald-300">Tersimpan</AlertTitle>
                <AlertDescription className="text-emerald-200/70">Perubahan berhasil disimpan dan langsung aktif di agent.</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
                <AlertCircle className="text-red-400" />
                <AlertTitle className="text-red-300">Gagal menyimpan</AlertTitle>
                <AlertDescription className="text-red-200/70">{errorMessage}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-100 tracking-tight">System Dashboard</h2>
                  <p className="text-sm text-slate-400 mt-1">Real-time infrastructure monitoring and analytics</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-zinc-800 text-zinc-300 border-white/10 px-3 py-1.5">
                    <Activity className="h-3 w-3 mr-1.5 animate-pulse" />
                    Live Production
                  </Badge>
                  <Badge className="bg-slate-800 text-slate-300 border-white/10 px-3 py-1.5  text-xs">
                    v2.1.0
                  </Badge>
                </div>
              </div>

              {/* Stats Cards - matte colored icons */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Total Requests", value: stats.totalRequests.toLocaleString(), icon: TrendingUp, iconBg: "bg-[#3f4a3c] border-[#4a5a45]", iconColor: "text-[#8fa88a]", change: "+18.2%", trend: "up" },
                  { label: "Active Sessions", value: stats.activeUsers.toString(), icon: User, iconBg: "bg-[#3d4a5c] border-[#45566e]", iconColor: "text-[#8aa4c8]", change: "+12.5%", trend: "up" },
                  { label: "Avg Latency", value: `${stats.avgResponseTime}s`, icon: Zap, iconBg: "bg-[#5c4a3a] border-[#6b5644]", iconColor: "text-[#c4a88a]", change: "-15.3%", trend: "down" },
                  { label: "Knowledge Entries", value: stats.knowledgeEntries.toString(), icon: Database, iconBg: "bg-[#4a3f5c] border-[#564a6e]", iconColor: "text-[#a88ac8]", change: "+24", trend: "up" },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                    >
                      <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl hover:border-white/[0.1] hover:bg-zinc-900/80 transition-all duration-300 shadow-lg relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <CardContent className="p-6 relative">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{stat.label}</p>
                              <p className="text-3xl font-bold text-white mb-3">{stat.value}</p>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                                  stat.trend === 'up' 
                                    ? 'bg-white/5 text-zinc-300 border-white/10' 
                                    : 'bg-zinc-800 text-zinc-400 border-white/10'
                                }`}>
                                  {stat.change}
                                </span>
                                <span className="text-xs text-zinc-600">vs 24h</span>
                              </div>
                            </div>
                            <div className={`flex h-14 w-14 items-center justify-center rounded-xl border ${stat.iconBg}`}>
                              <Icon className={`h-7 w-7 ${stat.iconColor}`} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Additional Metrics Row - matte variants */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">Uptime</p>
                        <p className="text-xl font-bold text-white">{stats.uptime}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3f4a3c] border border-[#4a5a45]">
                        <Clock className="h-5 w-5 text-[#8fa88a]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">Error Rate</p>
                        <p className="text-xl font-bold text-white">{stats.errorRate}%</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5c3a3a] border border-[#6b4444]">
                        <AlertCircle className="h-5 w-5 text-[#c48a8a]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">Tokens/24h</p>
                        <p className="text-xl font-bold text-white">{(stats.tokensProcessed / 1000000).toFixed(1)}M</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3a4a5c] border border-[#44556e]">
                        <Zap className="h-5 w-5 text-[#8aa4c8]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">Cache Hit</p>
                        <p className="text-xl font-bold text-white">{stats.cacheHitRate}%</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4a3f5c] border border-[#564a6e]">
                        <Database className="h-5 w-5 text-[#a88ac8]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                      <Activity className="h-5 w-5 text-zinc-300" />
                      REQUEST VOLUME (24H)
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs text-zinc-500">Production Traffic Analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={timeSeriesData}>
                        <defs>
                          <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} />
                        <XAxis dataKey="time" stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontFamily: 'monospace'
                          }} 
                        />
                        <Area type="monotone" dataKey="requests" stroke="#a1a1aa" fillOpacity={1} fill="url(#colorRequests)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                      <Zap className="h-5 w-5 text-zinc-300" />
                      RESPONSE LATENCY
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs text-zinc-500">Average Response Time (Seconds)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} />
                        <XAxis dataKey="time" stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontFamily: 'monospace'
                          }} 
                        />
                        <Line type="monotone" dataKey="responseTime" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                      <Database className="h-5 w-5 text-zinc-400" />
                      KNOWLEDGE DISTRIBUTION
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs text-zinc-500">Entries By Category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontFamily: 'monospace'
                          }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                      ERROR RATE (24H)
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs text-zinc-500">System Error Tracking</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} />
                        <XAxis dataKey="time" stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontFamily: 'monospace'
                          }} 
                        />
                        <Bar dataKey="errors" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* System Resources */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                      <TrendingUp className="h-5 w-5 text-zinc-300" />
                      CPU USAGE (24H)
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs text-zinc-500">Server CPU Utilization %</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={timeSeriesData}>
                        <defs>
                          <linearGradient id="colorCPU" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} />
                        <XAxis dataKey="time" stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontFamily: 'monospace'
                          }} 
                        />
                        <Area type="monotone" dataKey="cpu" stroke="#a1a1aa" fillOpacity={1} fill="url(#colorCPU)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                      <Database className="h-5 w-5 text-zinc-300" />
                      MEMORY USAGE (24H)
                    </CardTitle>
                    <CardDescription className="text-zinc-500 text-xs text-zinc-500">Server Memory Utilization %</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={timeSeriesData}>
                        <defs>
                          <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} />
                        <XAxis dataKey="time" stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fff',
                            fontFamily: 'monospace'
                          }} 
                        />
                        <Area type="monotone" dataKey="memory" stroke="#10b981" fillOpacity={1} fill="url(#colorMemory)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* System Status */}
              <Card className="border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-xl ">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-white font-bold">
                    <Activity className="h-5 w-5 text-zinc-300" />
                    SYSTEM HEALTH STATUS
                  </CardTitle>
                  <CardDescription className="text-zinc-500 text-xs text-zinc-500">Infrastructure Service Status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-800/50 p-4 backdrop-blur">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">System Uptime</p>
                        <p className="text-lg font-bold text-zinc-300 ">{stats.uptime}</p>
                      </div>
                      <Badge className="bg-zinc-800 text-zinc-300 border-white/10 ">ONLINE</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-800/50 p-4 backdrop-blur">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">API Status</p>
                        <p className="text-lg font-bold text-zinc-300 ">READY</p>
                      </div>
                      <Badge className="bg-zinc-800 text-zinc-300 border-white/10 ">LIVE</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-800/50 p-4 backdrop-blur">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-medium">Active Model</p>
                        <p className="text-xs  font-bold text-white truncate max-w-[180px]">{modelConfig.active_model.split('/')[1]?.slice(0, 20) || 'NOT_CONFIGURED'}</p>
                      </div>
                      <Sparkles className="h-8 w-8 text-zinc-400/30" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Bulk JSON toolbar */}
          {activeTab !== "models" && activeTab !== "dashboard" && (
            <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
              <CardContent className="flex flex-wrap items-center gap-2 py-3">
                <span className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <FileJson className="h-4 w-4" />
                  Bulk JSON
                </span>
                <Button variant="outline" size="sm" onClick={openJsonModalWithPrefill} className="border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300">
                  <Upload />
                  <span>Import JSON</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkExport} className="border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300">
                  <Download />
                  <span>Export JSON</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleBulkDownloadExample} className="text-zinc-400 hover:text-zinc-200">
                  Contoh format
                </Button>
              </CardContent>
            </Card>
          )}

          {/* TAB: AI MODELS */}
          {activeTab === "models" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-2xl font-bold">Model AI</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Model yang sedang dipakai ditampilkan pertama. Pilih dari katalog live atau ketik ID model apa pun.
                </p>
              </div>

              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-zinc-400" />
                    Model yang sedang dipakai
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="break-all  text-lg text-zinc-200">{modelConfig.active_model || "— belum dimuat —"}</p>
                  <p className="text-sm text-zinc-400">
                    provider: <span className="text-zinc-300">{modelConfig.provider}</span> · base: <span className="break-all text-zinc-300">{modelConfig.api_base_url}</span>
                  </p>
                  <p className="text-sm text-zinc-400">
                    Fallback: {modelConfig.fallback_models.length ? modelConfig.fallback_models.join(", ") : "— tidak ada —"} · temp: {modelConfig.temperature} · reasoning: {modelConfig.reasoning_enabled ? "aktif" : "nonaktif"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle>Konfigurasi Model</CardTitle>
                  <CardDescription className="text-zinc-400">Atur model aktif, provider, dan fallback chain</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#8fa88a]"><Cpu className="h-3.5 w-3.5" />ID model aktif</Label>
                    <Input 
                      list="admin-model-options" 
                      value={modelConfig.active_model} 
                      onChange={(e) => setModelConfig({ ...modelConfig, active_model: e.target.value })} 
                      placeholder="cth. qwen/qwen3.8-27b:free" 
                      className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#8fa88a]/30"
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
                      <Label className="flex items-center gap-2 text-[#8aa4c8]"><Box className="h-3.5 w-3.5" />Provider</Label>
                      <Input value={modelConfig.provider} onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })} placeholder="openrouter" className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#8aa4c8]/30 focus:bg-zinc-800" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-[#c4a88a]"><Globe className="h-3.5 w-3.5" />API base URL</Label>
                      <Input value={modelConfig.api_base_url} onChange={(e) => setModelConfig({ ...modelConfig, api_base_url: e.target.value })} placeholder="https://openrouter.ai/api/v1" className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#c4a88a]/30 focus:bg-zinc-800" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-[#a88ac8]"><Gauge className="h-3.5 w-3.5" />Temperature (0–2)</Label>
                      <Input type="number" min={0} max={2} step={0.1} value={modelConfig.temperature} onChange={(e) => setModelConfig({ ...modelConfig, temperature: Number(e.target.value) || 0 })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#a88ac8]/30 focus:bg-zinc-800" />
                    </div>
                    <Label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm font-normal text-[#8ac4b8]">
                      <Checkbox checked={modelConfig.reasoning_enabled} onCheckedChange={(checked) => setModelConfig({ ...modelConfig, reasoning_enabled: Boolean(checked) })} />
                      <span className="flex items-center gap-2"><Brain className="h-3.5 w-3.5" />Reasoning aktif</span>
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#c48a8a]"><Layers className="h-3.5 w-3.5" />Model fallback</Label>
                    <div className="flex flex-wrap gap-2">
                      {modelConfig.fallback_models.map((mid) => (
                        <Badge key={mid} variant="secondary" className="gap-2 py-1.5  text-xs bg-white/10 text-zinc-300">
                          {mid}
                          <button type="button" onClick={() => setModelConfig({ ...modelConfig, fallback_models: modelConfig.fallback_models.filter((x) => x !== mid) })} className="ml-1 rounded-full bg-red-500/20 text-red-300 px-1.5 py-0.5 text-[11px] hover:bg-red-600 hover:text-white border border-red-500/20" title="Hapus fallback">✕</button>
                        </Badge>
                      ))}
                      {modelConfig.fallback_models.length === 0 && <span className="text-sm text-zinc-500">Belum ada fallback</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input value={fallbackInput} onChange={(e) => setFallbackInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = fallbackInput.trim(); if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] }); setFallbackInput(""); }}} placeholder="Ketik ID model lalu Enter" className="flex-1 border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500" />
                      <Button type="button" onClick={() => { const v = fallbackInput.trim(); if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] }); setFallbackInput(""); }} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10">
                        <Plus /> Tambah
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSaveModelConfig} disabled={saving || !modelConfig.active_model.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">
                    <Save />
                    <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi Model"}</span>
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Katalog model live</CardTitle>
                      <CardDescription className="text-zinc-400">Sumber: katalog provider</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-zinc-300">
                        <Checkbox checked={freeOnly} onCheckedChange={(checked) => { setFreeOnly(Boolean(checked)); refreshAvailableModels({ freeOnly: Boolean(checked) }); }} />
                        Hanya gratis
                      </Label>
                      <Button variant="outline" size="sm" onClick={() => refreshAvailableModels()} disabled={modelsLoading} className="border-white/10 bg-white/5 text-zinc-300">
                        {modelsLoading ? "Memuat..." : "Muat ulang"}
                      </Button>
                      <Input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Cari model..." className="h-8 w-40 border-white/10 bg-white/5 text-white" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[28rem] overflow-y-auto rounded-b-xl border-t border-white/10">
                    {availableModels.length === 0 ? (
                      <div className="p-6 text-center text-sm text-zinc-500">
                        {modelsLoading ? "Memuat katalog..." : "Tidak ada model. Cek API key atau tekan Muat ulang."}
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/5">
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
                              <li key={m.id} className={`flex items-start justify-between gap-3 px-4 py-3 text-xs ${isActive ? "bg-white/5" : "hover:bg-white/5"}`}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 break-all  text-[11px] text-zinc-300">
                                    <span>{m.id}</span>
                                    {isActive && <Badge className="bg-zinc-800 text-zinc-200">AKTIF</Badge>}
                                    {m.pricing && (m.pricing.prompt === "0" || String(m.pricing.prompt) === "0.0000000") && <Badge variant="outline" className="border-white/10 text-zinc-300">GRATIS</Badge>}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{m.name || m.description || ""}</div>
                                  {m.context_length ? <div className="text-[11px] text-zinc-500">context: {Number(m.context_length).toLocaleString("id-ID")}</div> : null}
                                </div>
                                <div className="flex shrink-0 flex-col gap-1">
                                  <Button variant={isActive ? "secondary" : "default"} size="sm" onClick={() => setModelConfig({ ...modelConfig, active_model: m.id })} className={isActive ? "bg-zinc-800 text-zinc-200" : "bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20"}>{isActive ? "Aktif" : "Pakai"}</Button>
                                  <Button variant="outline" size="sm" onClick={() => { if (!modelConfig.fallback_models.includes(m.id)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, m.id] }); }} disabled={modelConfig.fallback_models.includes(m.id) || isActive} className="border-white/10 bg-white/5 text-zinc-300">+ Fallback</Button>
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

          {/* TAB: AI IDENTITY */}
          {activeTab === "identity" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle>Identitas AI</CardTitle>
                  <CardDescription className="text-zinc-400">Menentukan identitas dasar, nama, peran, dan tujuan ITZ AI.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#8fa88a]"><Fingerprint className="h-3.5 w-3.5" />Nama AI</Label>
                    <Input value={identityData.name} onChange={(e) => setIdentityData({ ...identityData, name: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#8fa88a]/30 focus:bg-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#8aa4c8]"><Briefcase className="h-3.5 w-3.5" />Peran</Label>
                    <Input value={identityData.role} onChange={(e) => setIdentityData({ ...identityData, role: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#8aa4c8]/30 focus:bg-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#c4a88a]"><ScrollText className="h-3.5 w-3.5" />Deskripsi</Label>
                    <Textarea rows={2} value={identityData.description} onChange={(e) => setIdentityData({ ...identityData, description: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#c4a88a]/30 focus:bg-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#a88ac8]"><Brain className="h-3.5 w-3.5" />Pernyataan Identitas</Label>
                    <Textarea rows={3} value={identityData.identity} onChange={(e) => setIdentityData({ ...identityData, identity: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#a88ac8]/30 focus:bg-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[#c48a8a]"><Target className="h-3.5 w-3.5" />Tujuan</Label>
                    <Textarea rows={3} value={identityData.purpose} onChange={(e) => setIdentityData({ ...identityData, purpose: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#c48a8a]/30 focus:bg-zinc-800" />
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={() => handleSaveConfig("identity")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">
                    <Save />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* TAB: PERSONAL INFORMATION */}
          {activeTab === "personal" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle>Informasi Personal</CardTitle>
                  <CardDescription className="text-zinc-400">Informasi mengenai owner yang dipakai sebagai konteks AI.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[
                    { key: "profile", label: "Profil", color: "#8fa88a", Icon: User },
                    { key: "background", label: "Latar Belakang", color: "#8aa4c8", Icon: History },
                    { key: "interests", label: "Minat", color: "#c4a88a", Icon: Heart },
                    { key: "experience", label: "Pengalaman", color: "#a88ac8", Icon: Briefcase },
                    { key: "projects", label: "Proyek", color: "#c48a8a", Icon: Rocket },
                    { key: "preferences", label: "Preferensi", color: "#8ac4b8", Icon: Settings2 },
                    { key: "relevant_context", label: "Konteks Relevan", color: "#a8a88a", Icon: MapPin },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className="flex items-center gap-2" style={{ color: item.color }}><Ico className="h-3.5 w-3.5" />{item.label}</Label>
                      <Textarea rows={2} value={(personalData as any)[item.key] || ""} onChange={(e) => setPersonalData({ ...personalData, [item.key]: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:bg-zinc-800" style={{ borderColor: "" } as any} onFocus={(e) => e.currentTarget.style.borderColor = item.color + "40"} onBlur={(e) => e.currentTarget.style.borderColor = ""} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={() => handleSaveConfig("personal")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">
                    <Save />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* TAB: KNOWLEDGE BASE */}
          {activeTab === "knowledge" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Basis Pengetahuan</CardTitle>
                      <CardDescription className="text-zinc-400">Pengetahuan owner terstruktur dan persisten dengan pencarian embedding semantik.</CardDescription>
                    </div>
                    <Button onClick={() => { setEntryForm({ id: "", title: "", content: "", category_id: "" }); setNewEntryModal(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10">
                      <Plus />
                      <span>Tambah Knowledge</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {knowledgeCategories.map((cat) => (
                      <Button key={cat.id} variant={selectedCategorySlug === cat.slug ? "default" : "outline"} size="sm" onClick={() => setSelectedCategorySlug(cat.slug)} className={selectedCategorySlug === cat.slug ? "bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10" : "border-white/10 bg-white/5 text-zinc-300"}>
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
                        <Card key={entry.id} className="border-white/[0.06] bg-zinc-800/60 backdrop-blur">
                          <CardContent className="flex items-start justify-between p-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold text-zinc-200">{entry.title}</h4>
                              <p className="line-clamp-2 text-xs text-zinc-400">{entry.content}</p>
                            </div>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteKnowledgeEntry(entry.id)} className="shrink-0 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white hover:border-red-600" title="Hapus entri">
                              <Trash2 />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    {knowledgeEntries.filter((e) => {
                      const cat = knowledgeCategories.find((c) => c.id === e.category_id);
                      return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
                    }).length === 0 && (
                      <Card className="border-dashed border-white/10 bg-zinc-900/40">
                        <CardContent className="p-8 text-center text-sm text-zinc-500">
                          Belum ada knowledge pada kategori ini. Klik &quot;Tambah Knowledge&quot; untuk membuat entri baru.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB: PERSONALITY */}
          {activeTab === "personality" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle>Kepribadian</CardTitle>
                  <CardDescription className="text-zinc-400">Menentukan karakter, nada, sikap, dan batasan perilaku AI.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[
                    { key: "personality", label: "Kepribadian", color: "#8fa88a", Icon: Brain },
                    { key: "tone", label: "Nada", color: "#8aa4c8", Icon: Mic2 },
                    { key: "attitude", label: "Sikap", color: "#c4a88a", Icon: Heart },
                    { key: "reasoning_style", label: "Gaya Penalaran", color: "#a88ac8", Icon: Lightbulb },
                    { key: "criticism_style", label: "Gaya Kritik", color: "#c48a8a", Icon: MessageSquare },
                    { key: "response_behavior", label: "Perilaku Respons", color: "#8ac4b8", Icon: Zap },
                    { key: "prohibited_behavior", label: "Perilaku Terlarang", color: "#c48a5c", Icon: ShieldCheck },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className="flex items-center gap-2" style={{ color: item.color }}><Ico className="h-3.5 w-3.5" />{item.label}</Label>
                      <Textarea rows={2} value={(personalityData as any)[item.key] || ""} onChange={(e) => setPersonalityData({ ...personalityData, [item.key]: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:bg-zinc-800" onFocus={(e) => e.currentTarget.style.borderColor = item.color + "40"} onBlur={(e) => e.currentTarget.style.borderColor = ""} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={() => handleSaveConfig("personality")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">
                    <Save />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* TAB: COMMUNICATION STYLE */}
          {activeTab === "communication" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle>Gaya Komunikasi</CardTitle>
                  <CardDescription className="text-zinc-400">Pengaturan bahasa, panjang respons, format, dan kedalaman teknis.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[
                    { key: "primary_language", label: "Bahasa Utama", color: "#8fa88a", Icon: Globe },
                    { key: "tone", label: "Nada", color: "#8aa4c8", Icon: Mic2 },
                    { key: "response_length", label: "Panjang Respons", color: "#c4a88a", Icon: Type },
                    { key: "formatting_preference", label: "Preferensi Format", color: "#a88ac8", Icon: Palette },
                    { key: "technical_depth", label: "Kedalaman Teknis", color: "#8ac4b8", Icon: Gauge },
                    { key: "explanation_style", label: "Gaya Penjelasan", color: "#a8a88a", Icon: PenTool },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className="flex items-center gap-2" style={{ color: item.color }}><Ico className="h-3.5 w-3.5" />{item.label}</Label>
                      <Input value={(commData as any)[item.key] || ""} onChange={(e) => setCommData({ ...commData, [item.key]: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:bg-zinc-800" onFocus={(e) => e.currentTarget.style.borderColor = item.color + "40"} onBlur={(e) => e.currentTarget.style.borderColor = ""} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={() => handleSaveConfig("communication")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">
                    <Save />
                    <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* TAB: SYSTEM INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl shadow-lg">
                <CardHeader>
                  <CardTitle>Instruksi Sistem</CardTitle>
                  <CardDescription className="text-zinc-400">Layer dengan prioritas tertinggi untuk behavioral rules, safety rules, dan knowledge priority.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[
                    { key: "behavioral_rules", label: "Behavioral Rules", color: "#8fa88a", Icon: Cog },
                    { key: "response_rules", label: "Response Rules", color: "#8aa4c8", Icon: ScrollText },
                    { key: "safety_rules", label: "Safety Rules", color: "#c48a8a", Icon: ShieldCheck },
                    { key: "knowledge_priority", label: "Knowledge Priority", color: "#c4a88a", Icon: Layers3 },
                    { key: "reasoning_constraints", label: "Reasoning Constraints", color: "#a88ac8", Icon: GitBranch },
                    { key: "formatting_rules", label: "Formatting Rules", color: "#8ac4b8", Icon: FileCode },
                  ].map((item) => {
                    const Ico = item.Icon;
                    return (
                    <div key={item.key} className="space-y-2">
                      <Label className="flex items-center gap-2" style={{ color: item.color }}><Ico className="h-3.5 w-3.5" />{item.label}</Label>
                      <Textarea rows={2} value={(sysData as any)[item.key] || ""} onChange={(e) => setSysData({ ...sysData, [item.key]: e.target.value })} className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:bg-zinc-800" onFocus={(e) => e.currentTarget.style.borderColor = item.color + "40"} onBlur={(e) => e.currentTarget.style.borderColor = ""} />
                    </div>
                  );})}
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={() => handleSaveConfig("instructions")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">
                    <Save />
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
        <DialogContent className="border-white/10 bg-[#0e0a1a] text-white">
          <DialogHeader>
            <DialogTitle>Tambah Knowledge Baru</DialogTitle>
            <DialogDescription className="text-zinc-400">Buat entri pengetahuan baru yang akan di-embedding dan dipakai sebagai konteks AI.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveKnowledgeEntry} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Judul / Topik</Label>
              <Input value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} required placeholder="Misal: Arsitektur Backend ITZ AI" className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-white/20 focus:bg-zinc-800" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Kategori</Label>
              <Select value={selectedCategorySlug} onValueChange={(v) => setSelectedCategorySlug(v ?? selectedCategorySlug)}>
                <SelectTrigger className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-white/20 focus:bg-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0e0a1a] text-white">
                  {knowledgeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Konten Pengetahuan</Label>
              <Textarea rows={5} value={entryForm.content} onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })} required placeholder="Tuliskan pengetahuan detail yang akan diserap oleh AI..." className="border-white/10 bg-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-white/20 focus:bg-zinc-800" />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setNewEntryModal(false)} className="border-white/10 bg-white/5 text-zinc-300">Batal</Button>
            <Button onClick={(e: any) => handleSaveKnowledgeEntry(e)} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10">Simpan &amp; Generate Embedding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk JSON Import/Export Modal */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col p-0 border-white/10 bg-[#0e0a1a] text-white">
          <DialogHeader className="border-b border-white/10 p-6 pb-4">
            <DialogTitle>Import JSON</DialogTitle>
            <DialogDescription className="text-zinc-400">Tempel JSON atau upload file untuk mengisi konfigurasi admin.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 border-b border-white/10 p-6 pt-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <div
              onDragOver={(e) => { e.preventDefault(); setJsonDrag(true); }}
              onDragLeave={() => setJsonDrag(false)}
              onDrop={(e) => { e.preventDefault(); setJsonDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void handleJsonFile(f); }}
              className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs ${jsonDrag ? "border-violet-500 bg-white/5 text-white" : "border-white/10 bg-white/5 text-zinc-400"}`}
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>{jsonDrag ? "Lepaskan file..." : "Drag & drop .json atau"}</span>
              <Button variant="link" size="sm" type="button" onClick={() => jsonFileRef.current?.click()} className="h-auto p-0 text-xs underline text-zinc-400">pilih file</Button>
              <Input ref={jsonFileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleJsonFile(f); e.target.value = ""; }} />
            </div>
            <Button variant="outline" size="sm" onClick={handleBulkDownloadExample} className="border-white/10 bg-white/5 text-zinc-300">
              <FileJson /> Example
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
              className="border-white/10 bg-white/5 text-zinc-300"
            >
              <Download /> .json
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(jsonText || ""); } catch {} }} className="border-white/10 bg-white/5 text-zinc-300">
              <Copy /> Copy
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {jsonError && (
              <Alert variant="destructive" className="mb-3 border-red-500/30 bg-red-500/10">
                <AlertCircle className="text-red-400" />
                <AlertTitle className="text-red-300">JSON error</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap text-red-200/70">{jsonError}</AlertDescription>
              </Alert>
            )}
            <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={18} spellCheck={false} placeholder='{"ai_identity": {...}, ...}' className=" text-xs leading-relaxed border-white/10 bg-white/5 text-white" />
          </div>

          <DialogFooter className="border-t border-white/10 p-6">
            <Button variant="outline" onClick={() => setShowJsonModal(false)} className="border-white/10 bg-white/5 text-zinc-300">Batal</Button>
            <Button variant="outline" onClick={() => { try { applyImportedDataToState(JSON.parse(jsonText)); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); } catch (e: any) { setJsonError(`Invalid JSON: ${e.message}`); } }} className="border-white/10 bg-white/5 text-zinc-300">Isi form saja</Button>
            <Button onClick={handleJsonApplyFromText} disabled={saving || !jsonText.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 shadow-lg shadow-emerald-600/20">{saving ? "Mengimpor..." : "Validasi & Import"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
