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
} from "lucide-react";
import Link from "next/link";

type TabType = "identity" | "personal" | "knowledge" | "personality" | "communication" | "instructions" | "models";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("identity");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Config states
  const [identityData, setIdentityData] = useState({ name: "", role: "", description: "", identity: "", purpose: "" });
  const [personalData, setPersonalData] = useState({ profile: "", background: "", interests: "", experience: "", projects: "", preferences: "", relevant_context: "" });
  const [personalityData, setPersonalityData] = useState({ personality: "", tone: "", attitude: "", reasoning_style: "", criticism_style: "", response_behavior: "", prohibited_behavior: "" });
  const [commData, setCommData] = useState({ primary_language: "", tone: "", response_length: "", formatting_preference: "", technical_depth: "", explanation_style: "" });
  const [sysData, setSysData] = useState({ behavioral_rules: "", response_rules: "", safety_rules: "", knowledge_priority: "", reasoning_constraints: "", formatting_rules: "" });

  // Model config states (dynamic — any model ID accepted)
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

  // Check auth on mount
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
      // Load configs
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
      if (catRes.ok) setKnowledgeCategories(await catRes.json());
      if (entRes.ok) setKnowledgeEntries(await entRes.json());
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
        // Also populate available models from the same call when present
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
      // Discovery endpoint as fallback
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

    // map frontend tab name to backend table name
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
      // Prefer server export (authoritative) when available
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
    // Fallback: serialize current state as example
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
    // NOTE: ai_model_config is intentionally skipped here — Models tab is manual-only.
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
    // Show in form immediately
    applyImportedDataToState(data);
    // Try server persist; if it fails, keep local-only and inform
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
    // Prefill with either server export or current form state
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
      <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 animate-spin text-emerald-400" />
          <span>Memeriksa otorisasi admin...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-full items-center justify-center bg-zinc-950 px-4 py-12">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-md">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-inner">
              <Shield className="h-6 w-6 text-emerald-400" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-zinc-100">ITZ AI Admin Panel</h2>
            <p className="mt-1 text-xs text-zinc-400">Control center untuk mengatur otak dan perilaku ITZ AI</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                placeholder="••••••••••••"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer"
            >
              Masuk Admin Panel
            </button>
          </form>

          <div className="text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Kembali ke Chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-950/80 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-200">ITZ AI Admin</h1>
              <p className="text-[11px] text-zinc-500">Control Center</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: "models", label: "AI Models", icon: Sparkles },
              { id: "identity", label: "AI Identity", icon: Sparkles },
              { id: "personal", label: "Personal Info", icon: User },
              { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
              { id: "personality", label: "Personality", icon: Sliders },
              { id: "communication", label: "Comm. Style", icon: MessageSquare },
              { id: "instructions", label: "System Instructions", icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-zinc-900 text-zinc-100 border border-zinc-800"
                      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 border-t border-zinc-900 pt-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Ke Public Chat</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Bulk JSON toolbar — hidden on Models tab (manual-only) */}
          {activeTab !== "models" && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
            <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <FileJson className="h-4 w-4 text-emerald-400" />
              Bulk JSON
            </span>
            <button
              onClick={openJsonModalWithPrefill}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              title="Upload / paste JSON to populate AI identity → system instructions"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import JSON</span>
            </button>
            <button
              onClick={handleBulkExport}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              title="Download all sections as one JSON file"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleBulkDownloadExample}
              className="rounded-xl px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
              title="Download example JSON format"
            >
              Example format
            </button>
          </div>
          )}

          {/* Mobile Header */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-4 md:hidden">
            <h2 className="text-base font-bold text-zinc-200">Admin Control Center</h2>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xs text-zinc-400">Chat</Link>
              <button onClick={handleLogout} className="text-xs text-red-400">Logout</button>
            </div>
          </div>

          {/* Feedback banner */}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4 text-xs text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>Perubahan berhasil disimpan dan langsung aktif di agent.</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 0: AI MODELS (dynamic — any provider/model ID) */}
          {activeTab === "models" && (
            <div className="space-y-6">
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-zinc-100">AI Models</h3>
                <p className="text-xs text-zinc-500">
                  Current model in use is shown first. Pick from the live catalog or type any model ID — not locked to Gemini or OpenRouter.
                  <br />
                  <span className="text-blue-400">Tip: Use local Ollama for unlimited free usage.</span> Install: <a href="https://ollama.ai" target="_blank" rel="noopener" className="underline hover:text-zinc-300">ollama.ai</a>
                </p>
              </div>

              {/* Local Model Detection & Info */}
              {modelConfig.api_base_url && (modelConfig.api_base_url.includes("localhost") || modelConfig.api_base_url.includes("127.0.0.1")) && (
                <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                    <Sparkles className="h-4 w-4" />
                    <span>Local Model Detected (Ollama)</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-300">
                    Running on local machine. Benefits:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                    <li>✓ Unlimited requests (no rate limits)</li>
                    <li>✓ No API costs</li>
                    <li>✓ Privacy — data stays local</li>
                    <li>✓ Works offline</li>
                  </ul>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Make sure Ollama is running: <code className="bg-zinc-900 px-2 py-1 rounded">ollama serve</code>
                  </p>
                </div>
              )}

              {/* Cloud Model Info */}
              {modelConfig.api_base_url && !modelConfig.api_base_url.includes("localhost") && !modelConfig.api_base_url.includes("127.0.0.1") && (
                <div className="rounded-2xl border border-yellow-900/40 bg-yellow-950/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-yellow-400">
                    <Sparkles className="h-4 w-4" />
                    <span>Cloud API Model</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-300">
                    Using remote API: <code className="bg-zinc-900 px-2 py-1 rounded text-[10px]">{modelConfig.api_base_url}</code>
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    Subject to rate limits and API costs. For unlimited usage, consider using local Ollama.
                  </p>
                </div>
              )}

              {/* Current in-use badge */}
              <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Sparkles className="h-4 w-4" />
                  <span>Current model in use</span>
                </div>
                <p className="mt-2 font-mono text-sm text-zinc-100 break-all">{modelConfig.active_model || "— belum dimuat —"}</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  provider: <span className="text-zinc-300">{modelConfig.provider}</span> · base:{" "}
                  <span className="text-zinc-300 break-all">{modelConfig.api_base_url}</span>
                </p>
                <p className="text-[11px] text-zinc-500">
                  Fallbacks: {modelConfig.fallback_models.length ? modelConfig.fallback_models.join(", ") : "— none —"} · temp: {modelConfig.temperature} · reasoning:{" "}
                  {modelConfig.reasoning_enabled ? "enabled" : "disabled"}
                </p>
              </div>

              <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Active model ID (any string accepted)</label>
                  <input
                    type="text"
                    list="admin-model-options"
                    value={modelConfig.active_model}
                    onChange={(e) => setModelConfig({ ...modelConfig, active_model: e.target.value })}
                    placeholder="e.g. qwen/qwen3.8-27b:free — or any OpenAI-compatible model ID"
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
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
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                  </datalist>
                  <p className="mt-1 text-[11px] text-zinc-500">Tip: start typing to filter. Or select from the catalog below.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">Provider</label>
                    <input
                      type="text"
                      value={modelConfig.provider}
                      onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })}
                      placeholder="openrouter"
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">API base URL</label>
                    <input
                      type="text"
                      value={modelConfig.api_base_url}
                      onChange={(e) => setModelConfig({ ...modelConfig, api_base_url: e.target.value })}
                      placeholder="https://openrouter.ai/api/v1"
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setModelConfig({ ...modelConfig, api_base_url: "http://localhost:11434/v1", provider: "ollama" })}
                      className="mt-1 text-[11px] text-blue-400 hover:text-blue-300"
                    >
                      Quick: Use local Ollama (http://localhost:11434/v1)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">Temperature (0–2)</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={modelConfig.temperature}
                      onChange={(e) => setModelConfig({ ...modelConfig, temperature: Number(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modelConfig.reasoning_enabled}
                      onChange={(e) => setModelConfig({ ...modelConfig, reasoning_enabled: e.target.checked })}
                      className="h-4 w-4 accent-zinc-100"
                    />
                    <span>Reasoning enabled (provider `reasoning` param)</span>
                  </label>
                </div>

                {/* Fallback chain editor */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Fallback models (tried in order when primary fails)</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {modelConfig.fallback_models.map((mid) => (
                      <span key={mid} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-mono text-zinc-200">
                        {mid}
                        <button
                          type="button"
                          onClick={() => setModelConfig({ ...modelConfig, fallback_models: modelConfig.fallback_models.filter((x) => x !== mid) })}
                          className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                          title="Remove fallback"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {modelConfig.fallback_models.length === 0 && <span className="text-xs text-zinc-500">No fallbacks — add one below.</span>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={fallbackInput}
                      onChange={(e) => setFallbackInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = fallbackInput.trim();
                          if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] });
                          setFallbackInput("");
                        }
                      }}
                      placeholder="Type model ID then Enter — e.g. cohere/north-mini-code:free"
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = fallbackInput.trim();
                        if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] });
                        setFallbackInput("");
                      }}
                      className="rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                    >
                      <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveModelConfig}
                    disabled={saving || !modelConfig.active_model.trim()}
                    className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? "Menyimpan..." : "Simpan Model Config"}</span>
                  </button>
                </div>
              </div>

              {/* Live catalog */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-semibold text-zinc-200">Live model catalog</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      <input type="checkbox" checked={freeOnly} onChange={(e) => { setFreeOnly(e.target.checked); refreshAvailableModels({ freeOnly: e.target.checked }); }} className="h-4 w-4 accent-zinc-100" />
                      Free only
                    </label>
                    <button
                      onClick={() => refreshAvailableModels()}
                      disabled={modelsLoading}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {modelsLoading ? "Loading..." : "Refresh"}
                    </button>
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="Search model..."
                      className="w-40 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-zinc-500">
                  Source: provider `/models` catalog — not hardcoded. Click a model to set it as active.
                </p>

                <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-zinc-800">
                  {availableModels.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500">
                      {modelsLoading ? "Loading catalog..." : "No models returned. Check API key / base URL or press Refresh."}
                    </div>
                  ) : (
                    <ul className="divide-y divide-zinc-800">
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
                            <li
                              key={m.id}
                              className={`flex items-start justify-between gap-3 px-3 py-2.5 text-xs ${isActive ? "bg-emerald-950/20" : "hover:bg-zinc-800/50"}`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-100 break-all">
                                  <span>{m.id}</span>
                                  {isActive && <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-300">ACTIVE</span>}
                                  {m.pricing && (m.pricing.prompt === "0" || String(m.pricing.prompt) === "0.0000000") && (
                                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">FREE</span>
                                  )}
                                </div>
                                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{m.name || m.description || ""}</div>
                                {m.context_length ? <div className="text-[11px] text-zinc-600">context: {Number(m.context_length).toLocaleString("id-ID")}</div> : null}
                              </div>
                              <div className="flex shrink-0 flex-col gap-1">
                                <button
                                  onClick={() => setModelConfig({ ...modelConfig, active_model: m.id })}
                                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${isActive ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"}`}
                                >
                                  {isActive ? "Current" : "Use"}
                                </button>
                                <button
                                  onClick={() => {
                                    if (!modelConfig.fallback_models.includes(m.id)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, m.id] });
                                  }}
                                  disabled={modelConfig.fallback_models.includes(m.id) || isActive}
                                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                                >
                                  + Fallback
                                </button>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: AI IDENTITY */}
          {activeTab === "identity" && (
            <div className="space-y-6">
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-zinc-100">AI Identity</h3>
                <p className="text-xs text-zinc-500">Menentukan identitas dasar, nama, role, dan purpose ITZ AI.</p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">AI Name</label>
                  <input
                    type="text"
                    value={identityData.name}
                    onChange={(e) => setIdentityData({ ...identityData, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Role</label>
                  <input
                    type="text"
                    value={identityData.role}
                    onChange={(e) => setIdentityData({ ...identityData, role: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Description</label>
                  <textarea
                    rows={2}
                    value={identityData.description}
                    onChange={(e) => setIdentityData({ ...identityData, description: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Identity Statement</label>
                  <textarea
                    rows={3}
                    value={identityData.identity}
                    onChange={(e) => setIdentityData({ ...identityData, identity: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Purpose</label>
                  <textarea
                    rows={3}
                    value={identityData.purpose}
                    onChange={(e) => setIdentityData({ ...identityData, purpose: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => handleSaveConfig("identity")}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL INFORMATION */}
          {activeTab === "personal" && (
            <div className="space-y-6">
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-zinc-100">Personal Information</h3>
                <p className="text-xs text-zinc-500">Informasi mengenai owner yang digunakan sebagai context AI.</p>
              </div>

              <div className="grid gap-4">
                {[
                  { key: "profile", label: "Profile" },
                  { key: "background", label: "Background" },
                  { key: "interests", label: "Interests" },
                  { key: "experience", label: "Experience" },
                  { key: "projects", label: "Projects" },
                  { key: "preferences", label: "Preferences" },
                  { key: "relevant_context", label: "Relevant Context" },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-medium text-zinc-400">{item.label}</label>
                    <textarea
                      rows={2}
                      value={(personalData as any)[item.key] || ""}
                      onChange={(e) => setPersonalData({ ...personalData, [item.key]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => handleSaveConfig("personal")}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: KNOWLEDGE BASE */}
          {activeTab === "knowledge" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Knowledge Base</h3>
                  <p className="text-xs text-zinc-500">Persistent structured owner knowledge with semantic embedding search.</p>
                </div>
                <button
                  onClick={() => {
                    setEntryForm({ id: "", title: "", content: "", category_id: "" });
                    setNewEntryModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-200 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Knowledge</span>
                </button>
              </div>

              {/* Category selector pills */}
              <div className="flex flex-wrap gap-2">
                {knowledgeCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategorySlug(cat.slug)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      selectedCategorySlug === cat.slug
                        ? "bg-zinc-100 text-zinc-950"
                        : "border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Entries list */}
              <div className="space-y-3">
                {knowledgeEntries
                  .filter((e) => {
                    const cat = knowledgeCategories.find((c) => c.id === e.category_id);
                    return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
                  })
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700"
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-zinc-200">{entry.title}</h4>
                        <p className="text-xs text-zinc-400 line-clamp-2">{entry.content}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDeleteKnowledgeEntry(entry.id)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-950/40 hover:text-red-400 transition-colors cursor-pointer"
                          title="Hapus entri"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                {knowledgeEntries.filter((e) => {
                  const cat = knowledgeCategories.find((c) => c.id === e.category_id);
                  return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
                }).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    Belum ada knowledge pada kategori ini. Klik "Tambah Knowledge" untuk membuat entri baru.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PERSONALITY */}
          {activeTab === "personality" && (
            <div className="space-y-6">
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-zinc-100">Personality</h3>
                <p className="text-xs text-zinc-500">Menentukan karakter, tone, attitude, dan batasan perilaku AI.</p>
              </div>

              <div className="grid gap-4">
                {[
                  { key: "personality", label: "Personality" },
                  { key: "tone", label: "Tone" },
                  { key: "attitude", label: "Attitude" },
                  { key: "reasoning_style", label: "Reasoning Style" },
                  { key: "criticism_style", label: "Criticism Style" },
                  { key: "response_behavior", label: "Response Behavior" },
                  { key: "prohibited_behavior", label: "Prohibited Behavior" },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-medium text-zinc-400">{item.label}</label>
                    <textarea
                      rows={2}
                      value={(personalityData as any)[item.key] || ""}
                      onChange={(e) => setPersonalityData({ ...personalityData, [item.key]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => handleSaveConfig("personality")}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: COMMUNICATION STYLE */}
          {activeTab === "communication" && (
            <div className="space-y-6">
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-zinc-100">Communication Style</h3>
                <p className="text-xs text-zinc-500">Pengaturan bahasa, panjang respons, format, dan technical depth.</p>
              </div>

              <div className="grid gap-4">
                {[
                  { key: "primary_language", label: "Primary Language" },
                  { key: "tone", label: "Tone" },
                  { key: "response_length", label: "Response Length" },
                  { key: "formatting_preference", label: "Formatting Preference" },
                  { key: "technical_depth", label: "Technical Depth" },
                  { key: "explanation_style", label: "Explanation Style" },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-medium text-zinc-400">{item.label}</label>
                    <input
                      type="text"
                      value={(commData as any)[item.key] || ""}
                      onChange={(e) => setCommData({ ...commData, [item.key]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => handleSaveConfig("communication")}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <div className="space-y-6">
              <div className="border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-zinc-100">System Instructions</h3>
                <p className="text-xs text-zinc-500">Layer dengan prioritas tertinggi untuk behavioral rules, safety rules, dan knowledge priority.</p>
              </div>

              <div className="grid gap-4">
                {[
                  { key: "behavioral_rules", label: "Behavioral Rules" },
                  { key: "response_rules", label: "Response Rules" },
                  { key: "safety_rules", label: "Safety Rules" },
                  { key: "knowledge_priority", label: "Knowledge Priority" },
                  { key: "reasoning_constraints", label: "Reasoning Constraints" },
                  { key: "formatting_rules", label: "Formatting Rules" },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-medium text-zinc-400">{item.label}</label>
                    <textarea
                      rows={2}
                      value={(sysData as any)[item.key] || ""}
                      onChange={(e) => setSysData({ ...sysData, [item.key]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => handleSaveConfig("instructions")}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Knowledge Entry Modal */}
      {newEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-base font-bold text-zinc-100">Tambah Knowledge Baru</h3>
              <button
                onClick={() => setNewEntryModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKnowledgeEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400">Judul / Topik</label>
                <input
                  type="text"
                  value={entryForm.title}
                  onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                  required
                  placeholder="Misal: Arsitektur Backend ITZ AI"
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400">Kategori</label>
                <select
                  value={selectedCategorySlug}
                  onChange={(e) => setSelectedCategorySlug(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                >
                  {knowledgeCategories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400">Konten Pengetahuan</label>
                <textarea
                  rows={5}
                  value={entryForm.content}
                  onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })}
                  required
                  placeholder="Tuliskan pengetahuan detail yang akan diserap oleh AI..."
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewEntryModal(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  Simpan & Generate Embedding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk JSON Import/Export Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 p-5">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Import JSON — populate admin fields</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Paste JSON, drag & drop a `.json` file, or pick one — fills AI Identity → System Instructions (+ knowledge). AI Models are managed manually on the Models tab and excluded from bulk import.
                </p>
              </div>
              <button onClick={() => setShowJsonModal(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 border-b border-zinc-800 p-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <div
                onDragOver={(e) => { e.preventDefault(); setJsonDrag(true); }}
                onDragLeave={() => setJsonDrag(false)}
                onDrop={(e) => { e.preventDefault(); setJsonDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void handleJsonFile(f); }}
                className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs ${jsonDrag ? "border-emerald-500 bg-emerald-950/20 text-emerald-300" : "border-zinc-800 bg-zinc-950 text-zinc-400"}`}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span>{jsonDrag ? "Drop JSON file..." : "Drag & drop .json here or"}</span>
                <button type="button" onClick={() => jsonFileRef.current?.click()} className="underline hover:text-zinc-200">browse</button>
                <input ref={jsonFileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleJsonFile(f); e.target.value = ""; }} />
              </div>
              <button onClick={handleBulkDownloadExample} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800" title="Example JSON shape">
                <span className="flex items-center gap-1.5"><FileJson className="h-3.5 w-3.5" /> Example</span>
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([jsonText || "{}"], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "admin-config.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                title="Download editor contents"
              >
                <span className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> .json</span>
              </button>
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(jsonText || ""); } catch {} }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                title="Copy JSON"
              >
                <span className="flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Copy</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {jsonError && (
                <div className="mb-3 whitespace-pre-wrap rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-400">
                  {jsonError}
                </div>
              )}
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={18}
                spellCheck={false}
                placeholder='{"ai_identity": {...}, "personal_information": {...}, ...}'
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
              <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                <summary className="cursor-pointer font-medium text-zinc-300">Expected JSON format (click to expand)</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">{`{
  "ai_identity": {
    "name": "ITZ AI",
    "role": "Personal AI Assistant",
    "description": "...",
    "identity": "...",
    "purpose": "..."
  },
  "personal_information": {
    "profile": "...", "background": "...",
    "interests": "...", "experience": "...",
    "projects": "...", "preferences": "...",
    "relevant_context": "..."
  },
  "ai_personality": {
    "personality": "...", "tone": "...",
    "attitude": "...", "reasoning_style": "...",
    "criticism_style": "...", "response_behavior": "...",
    "prohibited_behavior": "..."
  },
  "communication_settings": {
    "primary_language": "Bahasa Indonesia",
    "tone": "...", "response_length": "...",
    "formatting_preference": "...",
    "technical_depth": "...", "explanation_style": "..."
  },
  "system_instructions": {
    "behavioral_rules": "...", "response_rules": "...",
    "safety_rules": "...", "knowledge_priority": "...",
    "reasoning_constraints": "...", "formatting_rules": "..."
  },
  "knowledge_entries": [
    {
      "category_slug": "technical_knowledge",
      "title": "Backend stack",
      "content": "...",
      "tags": ["stack"],
      "is_active": true
    }
  ]
}`}</pre>
                <p className="mt-2 leading-relaxed">
                  Required: <span className="font-mono">ai_identity.name</span>, <span className="font-mono">ai_identity.role</span>,{" "}
                  <span className="font-mono">communication_settings.primary_language</span> (only when that section is present). Models are excluded — use the Models tab. Categories for knowledge entries resolve by{" "}
                  <span className="font-mono">category_slug</span> (<span className="font-mono">technical_knowledge</span>, <span className="font-mono">projects</span>, <span className="font-mono">experience</span>,{" "}
                  <span className="font-mono">preferences</span>, <span className="font-mono">custom_topics</span>). Full working example:{" "}
                  <span className="font-mono">data/admin_bulk_example.json</span> — use the “Example” button above to download it.
                </p>
              </details>
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-800 p-5 sm:flex-row sm:justify-end">
              <button onClick={() => setShowJsonModal(false)} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                Cancel
              </button>
              <button
                onClick={() => { try { applyImportedDataToState(JSON.parse(jsonText)); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); } catch (e: any) { setJsonError(`Invalid JSON: ${e.message}`); } }}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                title="Fill the form only — save per-tab afterward"
              >
                Fill form only
              </button>
              <button
                onClick={handleJsonApplyFromText}
                disabled={saving || !jsonText.trim()}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
                title="Validate + persist all sections + knowledge entries to the backend"
              >
                {saving ? "Importing..." : "Validate & Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
