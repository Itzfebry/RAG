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
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 animate-spin text-primary" />
          <span>Memeriksa otorisasi admin...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border bg-muted">
              <Shield className="h-6 w-6" />
            </div>
            <CardTitle className="mt-4 text-xl">Panel Admin ITZ AI</CardTitle>
            <CardDescription>Pusat kendali untuk mengatur otak dan perilaku ITZ AI</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-username">Nama Pengguna</Label>
                <Input id="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Kata Sandi</Label>
                <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••••••" />
              </div>
              {authError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Gagal masuk</AlertTitle>
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full">
                Masuk Panel Admin
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="link" size="sm" nativeButton={false} render={<Link href="/" />}>
              ← Kembali ke Chat
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen bg-background">
      {/* Sidebar - shadcn */}
      <aside className="hidden w-64 flex-col justify-between border-r bg-card p-6 md:flex">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border bg-muted">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Admin ITZ AI</h1>
              <p className="text-[11px] text-muted-foreground">Pusat Kendali</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: "models", label: "Model AI", icon: Sparkles },
              { id: "identity", label: "Identitas AI", icon: Sparkles },
              { id: "personal", label: "Info Personal", icon: User },
              { id: "knowledge", label: "Basis Pengetahuan", icon: BookOpen },
              { id: "personality", label: "Kepribadian", icon: Sliders },
              { id: "communication", label: "Gaya Komunikasi", icon: MessageSquare },
              { id: "instructions", label: "Instruksi Sistem", icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className="w-full justify-start gap-3"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Button variant="ghost" nativeButton={false} render={<Link href="/" />} className="w-full justify-start gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Ke Chat Publik</span>
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-2 text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Bulk JSON toolbar — hidden on Models tab */}
          {activeTab !== "models" && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 py-3">
                <span className="flex items-center gap-2 text-xs font-medium">
                  <FileJson className="h-4 w-4" />
                  Bulk JSON
                </span>
                <Button variant="outline" size="sm" onClick={openJsonModalWithPrefill} title="Unggah / tempel JSON untuk mengisi identitas AI → instruksi sistem">
                  <Upload />
                  <span>Import JSON</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkExport} title="Unduh semua bagian sebagai satu file JSON">
                  <Download />
                  <span>Export JSON</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleBulkDownloadExample} title="Unduh contoh format JSON">
                  Contoh format
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Mobile Header */}
          <div className="flex items-center justify-between border-b pb-4 md:hidden">
            <h2 className="text-base font-bold">Pusat Kendali Admin</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>Obrolan</Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive">Keluar</Button>
            </div>
          </div>

          {/* Feedback banner - shadcn Alert with all subcomponents */}
          {saveSuccess && (
            <Alert>
              <Check />
              <AlertTitle>Tersimpan</AlertTitle>
              <AlertDescription>Perubahan berhasil disimpan dan langsung aktif di agent.</AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Gagal menyimpan</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* TAB 0: AI MODELS */}
          {activeTab === "models" && (
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold">Model AI</h3>
                <p className="text-xs text-muted-foreground">
                  Model yang sedang dipakai ditampilkan pertama. Pilih dari katalog live atau ketik ID model apa pun — tidak terkunci ke Gemini atau OpenRouter.
                  <br />
                  <span className="text-primary">Tips: Gunakan Ollama lokal untuk pemakaian gratis tanpa batas.</span> Instal: <a href="https://ollama.ai" target="_blank" rel="noopener" className="underline hover:text-foreground">ollama.ai</a>
                </p>
              </div>

              {modelConfig.api_base_url && (modelConfig.api_base_url.includes("localhost") || modelConfig.api_base_url.includes("127.0.0.1")) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xs">
                      <Sparkles className="h-4 w-4" />
                      Model Lokal Terdeteksi (Ollama)
                    </CardTitle>
                    <CardDescription>Berjalan di mesin lokal. Keuntungan:</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <ul className="space-y-1 text-muted-foreground">
                      <li>✓ Permintaan tanpa batas (tanpa rate limit)</li>
                      <li>✓ Tanpa biaya API</li>
                      <li>✓ Privasi — data tetap lokal</li>
                      <li>✓ Bisa berjalan offline</li>
                    </ul>
                    <p className="text-[11px] text-muted-foreground">
                      Pastikan Ollama berjalan: <code className="rounded bg-muted px-2 py-1">ollama serve</code>
                    </p>
                  </CardContent>
                </Card>
              )}

              {modelConfig.api_base_url && !modelConfig.api_base_url.includes("localhost") && !modelConfig.api_base_url.includes("127.0.0.1") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xs">
                      <Sparkles className="h-4 w-4" />
                      Model API Cloud
                    </CardTitle>
                    <CardDescription>
                      Menggunakan API jarak jauh: <code className="rounded bg-muted px-2 py-1 text-[10px]">{modelConfig.api_base_url}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Terikat rate limit dan biaya API. Untuk pemakaian tanpa batas, pertimbangkan Ollama lokal.</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Sparkles className="h-4 w-4" />
                    Model yang sedang dipakai
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="break-all font-mono text-sm">{modelConfig.active_model || "— belum dimuat —"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    provider: <span className="text-foreground">{modelConfig.provider}</span> · base: <span className="break-all text-foreground">{modelConfig.api_base_url}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Fallback: {modelConfig.fallback_models.length ? modelConfig.fallback_models.join(", ") : "— tidak ada —"} · temp: {modelConfig.temperature} · reasoning: {modelConfig.reasoning_enabled ? "aktif" : "nonaktif"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Konfigurasi Model</CardTitle>
                  <CardDescription>Atur model aktif, provider, dan fallback chain</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-1.5">
                    <Label>ID model aktif (string apa pun diterima)</Label>
                    <Input list="admin-model-options" value={modelConfig.active_model} onChange={(e) => setModelConfig({ ...modelConfig, active_model: e.target.value })} placeholder="cth. qwen/qwen3.8-27b:free — atau ID model OpenAI-compatible apa pun" className="font-mono" />
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
                    <p className="text-[11px] text-muted-foreground">Tips: mulai mengetik untuk memfilter. Atau pilih dari katalog di bawah.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Provider</Label>
                      <Input value={modelConfig.provider} onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })} placeholder="openrouter" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>API base URL</Label>
                      <Input value={modelConfig.api_base_url} onChange={(e) => setModelConfig({ ...modelConfig, api_base_url: e.target.value })} placeholder="https://openrouter.ai/api/v1" />
                      <Button type="button" variant="link" size="sm" onClick={() => setModelConfig({ ...modelConfig, api_base_url: "http://localhost:11434/v1", provider: "ollama" })} className="h-auto p-0 text-xs">
                        Cepat: Gunakan Ollama lokal (http://localhost:11434/v1)
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Temperature (0–2)</Label>
                      <Input type="number" min={0} max={2} step={0.1} value={modelConfig.temperature} onChange={(e) => setModelConfig({ ...modelConfig, temperature: Number(e.target.value) || 0 })} />
                    </div>
                    <Label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-normal">
                      <Checkbox checked={modelConfig.reasoning_enabled} onCheckedChange={(checked) => setModelConfig({ ...modelConfig, reasoning_enabled: Boolean(checked) })} />
                      <span>Reasoning aktif (param <span className="font-mono">reasoning</span> provider)</span>
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Model fallback (dicoba berurutan saat model utama gagal)</Label>
                    <div className="flex flex-wrap gap-2">
                      {modelConfig.fallback_models.map((mid) => (
                        <Badge key={mid} variant="secondary" className="gap-2 py-1.5 font-mono text-xs">
                          {mid}
                          <button type="button" onClick={() => setModelConfig({ ...modelConfig, fallback_models: modelConfig.fallback_models.filter((x) => x !== mid) })} className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] hover:bg-muted-foreground/20" title="Hapus fallback">✕</button>
                        </Badge>
                      ))}
                      {modelConfig.fallback_models.length === 0 && <span className="text-xs text-muted-foreground">Belum ada fallback — tambah di bawah.</span>}
                    </div>
                    <div className="flex gap-2">
                      <Input value={fallbackInput} onChange={(e) => setFallbackInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = fallbackInput.trim(); if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] }); setFallbackInput(""); }}} placeholder="Ketik ID model lalu Enter — cth. cohere/north-mini-code:free" className="flex-1 font-mono" />
                      <Button type="button" onClick={() => { const v = fallbackInput.trim(); if (v && !modelConfig.fallback_models.includes(v)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, v] }); setFallbackInput(""); }}>
                        <Plus /> Tambah
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button onClick={handleSaveModelConfig} disabled={saving || !modelConfig.active_model.trim()}>
                    <Save />
                    <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi Model"}</span>
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Katalog model live</CardTitle>
                      <CardDescription>Sumber: katalog <span className="font-mono">/models</span> provider — bukan hardcoded.</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                        <Checkbox checked={freeOnly} onCheckedChange={(checked) => { setFreeOnly(Boolean(checked)); refreshAvailableModels({ freeOnly: Boolean(checked) }); }} />
                        Hanya gratis
                      </Label>
                      <Button variant="outline" size="sm" onClick={() => refreshAvailableModels()} disabled={modelsLoading}>
                        {modelsLoading ? "Memuat..." : "Muat ulang"}
                      </Button>
                      <Input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Cari model..." className="h-8 w-40" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[28rem] overflow-y-auto rounded-b-xl border-t">
                    {availableModels.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        {modelsLoading ? "Memuat katalog..." : "Tidak ada model. Cek API key / base URL atau tekan Muat ulang."}
                      </div>
                    ) : (
                      <ul className="divide-y">
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
                              <li key={m.id} className={`flex items-start justify-between gap-3 px-4 py-3 text-xs ${isActive ? "bg-muted/50" : "hover:bg-muted/30"}`}>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 break-all font-mono text-[11px]">
                                    <span>{m.id}</span>
                                    {isActive && <Badge>AKTIF</Badge>}
                                    {m.pricing && (m.pricing.prompt === "0" || String(m.pricing.prompt) === "0.0000000") && <Badge variant="outline">GRATIS</Badge>}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{m.name || m.description || ""}</div>
                                  {m.context_length ? <div className="text-[11px] text-muted-foreground">context: {Number(m.context_length).toLocaleString("id-ID")}</div> : null}
                                </div>
                                <div className="flex shrink-0 flex-col gap-1">
                                  <Button variant={isActive ? "secondary" : "default"} size="sm" onClick={() => setModelConfig({ ...modelConfig, active_model: m.id })}>{isActive ? "Aktif" : "Pakai"}</Button>
                                  <Button variant="outline" size="sm" onClick={() => { if (!modelConfig.fallback_models.includes(m.id)) setModelConfig({ ...modelConfig, fallback_models: [...modelConfig.fallback_models, m.id] }); }} disabled={modelConfig.fallback_models.includes(m.id) || isActive}>+ Fallback</Button>
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 1: AI IDENTITY */}
          {activeTab === "identity" && (
            <Card>
              <CardHeader>
                <CardTitle>Identitas AI</CardTitle>
                <CardDescription>Menentukan identitas dasar, nama, peran, dan tujuan ITZ AI.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>Nama AI</Label>
                  <Input value={identityData.name} onChange={(e) => setIdentityData({ ...identityData, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Peran</Label>
                  <Input value={identityData.role} onChange={(e) => setIdentityData({ ...identityData, role: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Deskripsi</Label>
                  <Textarea rows={2} value={identityData.description} onChange={(e) => setIdentityData({ ...identityData, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pernyataan Identitas</Label>
                  <Textarea rows={3} value={identityData.identity} onChange={(e) => setIdentityData({ ...identityData, identity: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tujuan</Label>
                  <Textarea rows={3} value={identityData.purpose} onChange={(e) => setIdentityData({ ...identityData, purpose: e.target.value })} />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => handleSaveConfig("identity")} disabled={saving}>
                  <Save />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* TAB 2: PERSONAL INFORMATION */}
          {activeTab === "personal" && (
            <Card>
              <CardHeader>
                <CardTitle>Informasi Personal</CardTitle>
                <CardDescription>Informasi mengenai owner yang dipakai sebagai konteks AI.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  { key: "profile", label: "Profil" },
                  { key: "background", label: "Latar Belakang" },
                  { key: "interests", label: "Minat" },
                  { key: "experience", label: "Pengalaman" },
                  { key: "projects", label: "Proyek" },
                  { key: "preferences", label: "Preferensi" },
                  { key: "relevant_context", label: "Konteks Relevan" },
                ].map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <Label>{item.label}</Label>
                    <Textarea rows={2} value={(personalData as any)[item.key] || ""} onChange={(e) => setPersonalData({ ...personalData, [item.key]: e.target.value })} />
                  </div>
                ))}
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => handleSaveConfig("personal")} disabled={saving}>
                  <Save />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* TAB 3: KNOWLEDGE BASE */}
          {activeTab === "knowledge" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Basis Pengetahuan</CardTitle>
                      <CardDescription>Pengetahuan owner terstruktur dan persisten dengan pencarian embedding semantik.</CardDescription>
                    </div>
                    <Button onClick={() => { setEntryForm({ id: "", title: "", content: "", category_id: "" }); setNewEntryModal(true); }}>
                      <Plus />
                      <span>Tambah Knowledge</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {knowledgeCategories.map((cat) => (
                      <Button key={cat.id} variant={selectedCategorySlug === cat.slug ? "default" : "outline"} size="sm" onClick={() => setSelectedCategorySlug(cat.slug)}>
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
                        <Card key={entry.id}>
                          <CardContent className="flex items-start justify-between p-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold">{entry.title}</h4>
                              <p className="line-clamp-2 text-xs text-muted-foreground">{entry.content}</p>
                            </div>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteKnowledgeEntry(entry.id)} className="shrink-0 text-muted-foreground hover:text-destructive" title="Hapus entri">
                              <Trash2 />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    {knowledgeEntries.filter((e) => {
                      const cat = knowledgeCategories.find((c) => c.id === e.category_id);
                      return !selectedCategorySlug || (cat && cat.slug === selectedCategorySlug);
                    }).length === 0 && (
                      <Card className="border-dashed">
                        <CardContent className="p-8 text-center text-xs text-muted-foreground">
                          Belum ada knowledge pada kategori ini. Klik &quot;Tambah Knowledge&quot; untuk membuat entri baru.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: PERSONALITY */}
          {activeTab === "personality" && (
            <Card>
              <CardHeader>
                <CardTitle>Kepribadian</CardTitle>
                <CardDescription>Menentukan karakter, nada, sikap, dan batasan perilaku AI.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  { key: "personality", label: "Kepribadian" },
                  { key: "tone", label: "Nada" },
                  { key: "attitude", label: "Sikap" },
                  { key: "reasoning_style", label: "Gaya Penalaran" },
                  { key: "criticism_style", label: "Gaya Kritik" },
                  { key: "response_behavior", label: "Perilaku Respons" },
                  { key: "prohibited_behavior", label: "Perilaku Terlarang" },
                ].map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <Label>{item.label}</Label>
                    <Textarea rows={2} value={(personalityData as any)[item.key] || ""} onChange={(e) => setPersonalityData({ ...personalityData, [item.key]: e.target.value })} />
                  </div>
                ))}
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => handleSaveConfig("personality")} disabled={saving}>
                  <Save />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* TAB 5: COMMUNICATION STYLE */}
          {activeTab === "communication" && (
            <Card>
              <CardHeader>
                <CardTitle>Gaya Komunikasi</CardTitle>
                <CardDescription>Pengaturan bahasa, panjang respons, format, dan kedalaman teknis.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  { key: "primary_language", label: "Bahasa Utama" },
                  { key: "tone", label: "Nada" },
                  { key: "response_length", label: "Panjang Respons" },
                  { key: "formatting_preference", label: "Preferensi Format" },
                  { key: "technical_depth", label: "Kedalaman Teknis" },
                  { key: "explanation_style", label: "Gaya Penjelasan" },
                ].map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <Label>{item.label}</Label>
                    <Input value={(commData as any)[item.key] || ""} onChange={(e) => setCommData({ ...commData, [item.key]: e.target.value })} />
                  </div>
                ))}
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => handleSaveConfig("communication")} disabled={saving}>
                  <Save />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* TAB 6: SYSTEM INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <Card>
              <CardHeader>
                <CardTitle>Instruksi Sistem</CardTitle>
                <CardDescription>Layer dengan prioritas tertinggi untuk behavioral rules, safety rules, dan knowledge priority.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {[
                  { key: "behavioral_rules", label: "Behavioral Rules" },
                  { key: "response_rules", label: "Response Rules" },
                  { key: "safety_rules", label: "Safety Rules" },
                  { key: "knowledge_priority", label: "Knowledge Priority" },
                  { key: "reasoning_constraints", label: "Reasoning Constraints" },
                  { key: "formatting_rules", label: "Formatting Rules" },
                ].map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <Label>{item.label}</Label>
                    <Textarea rows={2} value={(sysData as any)[item.key] || ""} onChange={(e) => setSysData({ ...sysData, [item.key]: e.target.value })} />
                  </div>
                ))}
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => handleSaveConfig("instructions")} disabled={saving}>
                  <Save />
                  <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      {/* New Knowledge Entry Modal - shadcn Dialog with all subcomponents */}
      <Dialog open={newEntryModal} onOpenChange={setNewEntryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Knowledge Baru</DialogTitle>
            <DialogDescription>Buat entri pengetahuan baru yang akan di-embedding dan dipakai sebagai konteks AI.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveKnowledgeEntry} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Judul / Topik</Label>
              <Input value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} required placeholder="Misal: Arsitektur Backend ITZ AI" />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={selectedCategorySlug} onValueChange={(v) => setSelectedCategorySlug(v ?? selectedCategorySlug)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {knowledgeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Konten Pengetahuan</Label>
              <Textarea rows={5} value={entryForm.content} onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })} required placeholder="Tuliskan pengetahuan detail yang akan diserap oleh AI..." />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setNewEntryModal(false)}>Batal</Button>
            <Button onClick={(e: any) => handleSaveKnowledgeEntry(e)}>Simpan &amp; Generate Embedding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk JSON Import/Export Modal - shadcn Dialog */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col p-0">
          <DialogHeader className="border-b p-6 pb-4">
            <DialogTitle>Import JSON — isi field admin</DialogTitle>
            <DialogDescription>Tempel JSON, drag &amp; drop file <span className="font-mono">.json</span>, atau pilih file — mengisi Identitas AI → Instruksi Sistem (+ knowledge). Model AI dikelola manual di tab Model.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 border-b p-6 pt-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <div
              onDragOver={(e) => { e.preventDefault(); setJsonDrag(true); }}
              onDragLeave={() => setJsonDrag(false)}
              onDrop={(e) => { e.preventDefault(); setJsonDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void handleJsonFile(f); }}
              className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs ${jsonDrag ? "border-primary bg-muted text-foreground" : "border-input bg-muted/30 text-muted-foreground"}`}
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>{jsonDrag ? "Lepaskan file JSON..." : "Drag & drop .json di sini atau"}</span>
              <Button variant="link" size="sm" type="button" onClick={() => jsonFileRef.current?.click()} className="h-auto p-0 text-xs underline">pilih file</Button>
              <Input ref={jsonFileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleJsonFile(f); e.target.value = ""; }} />
            </div>
            <Button variant="outline" size="sm" onClick={handleBulkDownloadExample} title="Example JSON shape">
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
              title="Download editor contents"
            >
              <Download /> .json
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(jsonText || ""); } catch {} }} title="Copy JSON">
              <Copy /> Copy
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {jsonError && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle />
                <AlertTitle>JSON error</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap">{jsonError}</AlertDescription>
              </Alert>
            )}
            <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={18} spellCheck={false} placeholder='{"ai_identity": {...}, "personal_information": {...}, ...}' className="font-mono text-xs leading-relaxed" />
            <details className="mt-3 rounded-lg border p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Format JSON yang diharapkan (klik untuk buka)</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">{`{
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
                Required: <span className="font-mono">ai_identity.name</span>, <span className="font-mono">ai_identity.role</span>, <span className="font-mono">communication_settings.primary_language</span> (only when that section is present). Categories for knowledge entries resolve by <span className="font-mono">category_slug</span> (<span className="font-mono">technical_knowledge</span>, <span className="font-mono">projects</span>, <span className="font-mono">experience</span>, <span className="font-mono">preferences</span>, <span className="font-mono">custom_topics</span>). Full working example: <span className="font-mono">data/admin_bulk_example.json</span>.
              </p>
            </details>
          </div>

          <DialogFooter className="border-t p-6">
            <Button variant="outline" onClick={() => setShowJsonModal(false)}>Batal</Button>
            <Button variant="outline" onClick={() => { try { applyImportedDataToState(JSON.parse(jsonText)); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); } catch (e: any) { setJsonError(`Invalid JSON: ${e.message}`); } }} title="Isi form saja — simpan per-tab setelahnya">Isi form saja</Button>
            <Button onClick={handleJsonApplyFromText} disabled={saving || !jsonText.trim()} title="Validasi + simpan semua bagian + knowledge entries ke backend">{saving ? "Mengimpor..." : "Validasi & Import"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
