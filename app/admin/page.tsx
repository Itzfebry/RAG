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
  ChevronRight,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

type TabType = "identity" | "personal" | "knowledge" | "personality" | "communication" | "instructions";

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

  // Knowledge states
  const [knowledgeCategories, setKnowledgeCategories] = useState<any[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<any[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("technical_knowledge");
  const [newEntryModal, setNewEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ id: "", title: "", content: "", category_id: "" });

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
      const [idRes, perRes, persRes, commRes, sysRes, catRes, entRes] = await Promise.all([
        fetch("/api/python/admin/config/ai_identity"),
        fetch("/api/python/admin/config/personal_information"),
        fetch("/api/python/admin/config/ai_personality"),
        fetch("/api/python/admin/config/communication_settings"),
        fetch("/api/python/admin/config/system_instructions"),
        fetch("/api/python/admin/knowledge/categories"),
        fetch("/api/python/admin/knowledge/entries"),
      ]);

      if (idRes.ok) setIdentityData(await idRes.json());
      if (perRes.ok) setPersonalData(await perRes.json());
      if (persRes.ok) setPersonalityData(await persRes.json());
      if (commRes.ok) setCommData(await commRes.json());
      if (sysRes.ok) setSysData(await sysRes.json());
      if (catRes.ok) setKnowledgeCategories(await catRes.json());
      if (entRes.ok) setKnowledgeEntries(await entRes.json());
    } catch (err) {
      console.error("Error loading admin data:", err);
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
    </div>
  );
}
