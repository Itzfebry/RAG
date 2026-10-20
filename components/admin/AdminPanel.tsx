"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  User,
  BookOpen,
  MessageSquare,
  FileText,
  LogOut,
  Check,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Upload,
  Download,
  FileJson,
  X,
  Coins,
  BarChart3,
  Brain,
  Fingerprint,
  Layers,
  Palette,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, m } from "framer-motion";

// LazyMotion renders `m` components; alias keeps all call sites unchanged.
const motion = m;
import { cardBase } from "./adminStyles";
import { IdentityTab } from "./tabs/IdentityTab";
import { PersonalTab } from "./tabs/PersonalTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { PersonalityTab } from "./tabs/PersonalityTab";
import { CommunicationTab } from "./tabs/CommunicationTab";
import { InstructionsTab } from "./tabs/InstructionsTab";
import { StylesTab } from "./tabs/StylesTab";
import { PricingTab } from "./tabs/PricingTab";
import { SectionHeader } from "./SectionHeader";
import { FieldInfo } from "./FieldInfo";
import {
  useAdminBootstrap,
  type AdminBootstrapApi,
  type TabType,
} from "./hooks/use-admin-bootstrap";
import { useAdminUsers } from "./hooks/use-admin-users";
import { useAdminTokens } from "./hooks/use-admin-tokens";
import { useAdminKnowledge } from "./hooks/use-admin-knowledge";
import { DashboardTab } from "./tabs/DashboardTab";
import { UsersTab } from "./tabs/UsersTab";
import { ModelsTab } from "./tabs/ModelsTab";
import { KnowledgeEntryModal } from "./modals/KnowledgeEntryModal";
import { JsonImportModal } from "./modals/JsonImportModal";

// TabType dipindah ke hooks/use-admin-bootstrap.ts (diimport di atas).
// RealStats dipindah ke hooks/use-admin-tokens.ts.

type ToastKind = "success" | "error" | "info";
type Toast = { id: string; kind: ToastKind; title: string; desc?: string };

// parseAppSettings dipindah ke hooks/use-admin-users.ts.

export default function AdminPanel({ initialTab = "dashboard" as TabType }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    const url = tab === "dashboard" ? "/admin/dashboard" : `/admin/${tab}`;
    try {
      window.history.pushState(null, "", url);
    } catch {}
  };

  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = React.useCallback((kind: ToastKind, title: string, desc?: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, kind, title, desc }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);
  const dismissToast = React.useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

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

  /* ---- ekstraksi data-loading: custom hooks (Phase A) ---- */
  const bootRef = useRef<AdminBootstrapApi | null>(null);
  const usersApi = useAdminUsers({ authExpired, pushToast });
  const knowledgeApi = useAdminKnowledge({
    authExpired,
    pushToast,
    getBootstrap: () => bootRef.current,
  });
  const boot = useAdminBootstrap({
    authExpired,
    pushToast,
    router,
    setUsers: usersApi.setUsers,
    setUsersLoading: usersApi.setUsersLoading,
    setAppSettings: usersApi.setAppSettings,
    onBootstrapKnowledge: knowledgeApi.ingestBootstrap,
    knowledgeEntries: knowledgeApi.knowledgeEntries,
    knowledgeCategories: knowledgeApi.knowledgeCategories,
  });
  useEffect(() => {
    bootRef.current = boot;
  });
  const tokensApi = useAdminTokens({
    authExpired,
    pushToast,
    isAuthenticated: boot.isAuthenticated,
    setCategoryData: knowledgeApi.setCategoryData,
  });

  const {
    isAuthenticated,
    isLoadingAuth,
    health,
    healthError,
    auditRows,
    loadAudit,
    saving,
    setSaveSuccess,
    identityData,
    setIdentityData,
    personalData,
    setPersonalData,
    personalityData,
    setPersonalityData,
    commData,
    setCommData,
    sysData,
    setSysData,
    stylesData,
    setStylesData,
    pricingData,
    setPricingData,
    modelConfig,
    setModelConfig,
    availableModels,
    modelsLoading,
    modelSearch,
    setModelSearch,
    freeOnly,
    setFreeOnly,
    fallbackInput,
    setFallbackInput,
    catalogApiKey,
    setCatalogApiKey,
    catalogBaseUrl,
    setCatalogBaseUrl,
    showCatalogKey,
    setShowCatalogKey,
    modelTestResults,
    handleTestModel,
    refreshAvailableModels,
    handleSaveModelConfig,
    handleSaveConfig,
    handleSavePricing,
    handleLogout,
    showJsonModal,
    setShowJsonModal,
    jsonText,
    setJsonText,
    jsonError,
    setJsonError,
    jsonDrag,
    setJsonDrag,
    jsonFileRef,
    handleBulkExport,
    handleBulkDownloadExample,
    applyImportedDataToState,
    handleJsonApplyFromText,
    handleJsonFile,
    openJsonModalWithPrefill,
  } = boot;

  const {
    users,
    usersLoading,
    syncingUsers,
    appSettings,
    setAppSettings,
    userModalOpen,
    setUserModalOpen,
    savingUser,
    savingSettings,
    editingUserId,
    setEditingUserId,
    userForm,
    setUserForm,
    handleSyncLocalUsers,
    handleCreateOrUpdateUser,
    handleDeleteUser,
    handleResetUsage,
    handleSaveSettings,
  } = usersApi;

  const {
    knowledgeCategories,
    knowledgeEntries,
    selectedCategorySlug,
    setSelectedCategorySlug,
    newEntryModal,
    setNewEntryModal,
    entrySaving,
    entryForm,
    setEntryForm,
    categoryData,
    reindexing,
    runReindex,
    handleSaveKnowledgeEntry,
    handleDeleteKnowledgeEntry,
  } = knowledgeApi;

  const {
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
  } = tokensApi;

  const ToastStack = (
    <div
      aria-live="polite"
      aria-atomic={false}
      className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[92vw] max-w-[380px] flex-col gap-2 sm:right-4 sm:top-4"
    >
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
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isSuccess ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-400" : isError ? "border-red-500/20 bg-red-500/15 text-red-400" : "border-white/10 bg-white/[0.06] text-zinc-300"}`}
                aria-hidden
              >
                {isSuccess ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isError ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[16px] font-medium leading-none ${isSuccess ? "text-emerald-200" : isError ? "text-red-200" : "text-zinc-100"}`}
                >
                  {t.title}
                </p>
                {t.desc && (
                  <p
                    className={`mt-1.5 text-[14px] leading-[1.5] break-words ${isSuccess ? "text-emerald-200/60" : isError ? "text-red-200/60" : "text-zinc-400"}`}
                  >
                    {t.desc}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Tutup notifikasi"
                className="pointer-events-auto -mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_800px_400px_at_50%_-10%,rgba(255,255,255,0.05),transparent_60%)]"
        />
        <div className="relative flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900">
            <img
              src="/image/favicon.png"
              alt=""
              width={44}
              height={44}
              className="h-full w-full object-cover opacity-90"
            />
          </div>
          <div className="flex items-center gap-2 text-[16px] tracking-wide text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span>Memeriksa sesi…</span>
          </div>
        </div>
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
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`${mobileNavOpen ? "fixed inset-y-0 left-0 z-30 flex" : "hidden"} w-[272px] shrink-0 flex-col justify-between border-r border-white/[0.07] bg-[#050507] p-5 md:relative md:z-10 md:flex`}
      >
        <div>
          <div className="mb-8 flex items-center gap-3 animate-in fade-in slide-in-from-left-5 duration-300 fill-mode-both">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black">
              <img
                src="/image/favicon.png"
                alt="ITZ"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold tracking-[0.08em] text-white">ITZ AI</h1>
              <p className="text-[13px] font-medium tracking-[0.14em] text-zinc-500">CONSOLE</p>
            </div>
          </div>

          <nav className="space-y-5" aria-label="Navigasi admin">
            {[
              {
                group: "Ringkasan",
                items: [{ id: "dashboard", label: "Dashboard", icon: BarChart3 }],
              },
              {
                group: "Pengguna",
                items: [
                  { id: "users", label: "Users", icon: User },
                  { id: "pricing", label: "Harga & Paket", icon: Coins },
                ],
              },
              {
                group: "AI & Respons",
                items: [
                  { id: "models", label: "AI Models", icon: Sparkles },
                  { id: "styles", label: "Gaya Respons", icon: Palette },
                  { id: "communication", label: "Komunikasi", icon: MessageSquare },
                  { id: "instructions", label: "Aturan Sistem", icon: FileText },
                ],
              },
              {
                group: "Konten & Persona",
                items: [
                  { id: "identity", label: "Identity", icon: Fingerprint },
                  { id: "personal", label: "Personal Info", icon: User },
                  { id: "personality", label: "Persona", icon: Brain },
                  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
                ],
              },
            ].map((group) => (
              <div key={group.group}>
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  {group.group}
                </p>
                <div className="space-y-0.5 border-l border-white/[0.06] pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? "secondary" : "ghost"}
                        onClick={() => switchTab(item.id as TabType)}
                        aria-current={isActive ? "page" : undefined}
                        className={`w-full justify-start gap-2.5 text-[14px] font-medium h-9 transition-colors cursor-pointer ${
                          isActive
                            ? "bg-white/[0.08] text-white border border-white/[0.12]"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        <Icon className="h-[15px] w-[15px] shrink-0" />
                        <span>{item.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-4">
          <div
            className="mb-3 space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[13px]"
            aria-label="Status sistem"
          >
            {(() => {
              const backendOk = !!health && !healthError;
              const dbOk = !!health?.database?.ok;
              const dot = (ok: boolean | undefined) =>
                ok === undefined ? "bg-zinc-600" : ok ? "bg-emerald-400" : "bg-red-400";
              return (
                <>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${backendOk ? "bg-emerald-400 animate-pulse" : healthError ? "bg-red-400" : "bg-zinc-600"}`}
                        aria-hidden
                      />
                      Backend
                    </span>
                    <span
                      className={
                        backendOk
                          ? "text-emerald-300"
                          : healthError
                            ? "text-red-300"
                            : "text-zinc-500"
                      }
                    >
                      {backendOk ? "online" : healthError ? "offline" : "..."}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${dot(health ? dbOk : undefined)}`}
                        aria-hidden
                      />
                      Database
                    </span>
                    <span className="font-mono text-zinc-500">
                      {health ? health.database?.mode : "..."}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/chat" />}
            className="w-full justify-start gap-2.5 text-[16px] font-medium h-9 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Chat</span>
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2.5 text-[16px] font-medium h-9 text-zinc-500 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 relative z-10">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[15px] text-zinc-200"
            aria-label="Buka menu navigasi"
            aria-expanded={mobileNavOpen}
          >
            <Layers className="h-4 w-4" aria-hidden />
            Menu
          </button>
          <span className="text-[13px] tracking-[0.14em] text-zinc-500">CONSOLE</span>
        </div>
        <div className="mx-auto max-w-6xl space-y-6">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <DashboardTab
              health={health}
              healthError={healthError}
              auditRows={auditRows}
              loadAudit={loadAudit}
              modelConfig={modelConfig}
              availableModels={availableModels}
              categoryData={categoryData}
              reindexing={reindexing}
              runReindex={runReindex}
              realStats={realStats}
              tokenStats={tokenStats}
              budgetInput={budgetInput}
              setBudgetInput={setBudgetInput}
              statsLoading={statsLoading}
              chartPeriod={chartPeriod}
              setChartPeriod={setChartPeriod}
              tokenDays={tokenDays}
              setTokenDays={setTokenDays}
              fetchStats={fetchStats}
              saveTokenBudget={saveTokenBudget}
            />
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <UsersTab
              users={users}
              usersLoading={usersLoading}
              syncingUsers={syncingUsers}
              appSettings={appSettings}
              setAppSettings={setAppSettings}
              onSaveSettings={handleSaveSettings}
              onSyncLocalUsers={handleSyncLocalUsers}
              userModalOpen={userModalOpen}
              setUserModalOpen={setUserModalOpen}
              savingUser={savingUser}
              savingSettings={savingSettings}
              editingUserId={editingUserId}
              setEditingUserId={setEditingUserId}
              userForm={userForm}
              setUserForm={setUserForm}
              onSubmitUser={handleCreateOrUpdateUser}
              onDeleteUser={handleDeleteUser}
              onResetUsage={handleResetUsage}
            />
          )}

          {/* Bulk JSON toolbar */}
          {activeTab !== "models" &&
            activeTab !== "dashboard" &&
            activeTab !== "users" &&
            activeTab !== "pricing" && (
              <Card className={cardBase}>
                <CardContent className="flex flex-wrap items-center gap-2 p-5">
                  <span className="flex items-center gap-2 text-[14px] font-medium tracking-[0.06em] text-zinc-400 uppercase">
                    <FileJson className="h-4 w-4" />
                    Bulk JSON
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openJsonModalWithPrefill}
                    className="h-8 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-[16px] gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import JSON</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    className="h-8 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-[16px] gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export JSON</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkDownloadExample}
                    className="h-8 text-zinc-500 hover:text-zinc-200 text-[16px]"
                  >
                    Contoh format
                  </Button>
                </CardContent>
              </Card>
            )}

          {/* MODELS */}
          {activeTab === "models" && (
            <ModelsTab
              modelConfig={modelConfig}
              setModelConfig={setModelConfig}
              modelTestResults={modelTestResults}
              onTestModel={handleTestModel}
              onSaveModelConfig={handleSaveModelConfig}
              saving={saving}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              modelSearch={modelSearch}
              setModelSearch={setModelSearch}
              freeOnly={freeOnly}
              setFreeOnly={setFreeOnly}
              fallbackInput={fallbackInput}
              setFallbackInput={setFallbackInput}
              catalogApiKey={catalogApiKey}
              setCatalogApiKey={setCatalogApiKey}
              catalogBaseUrl={catalogBaseUrl}
              setCatalogBaseUrl={setCatalogBaseUrl}
              showCatalogKey={showCatalogKey}
              setShowCatalogKey={setShowCatalogKey}
              refreshAvailableModels={refreshAvailableModels}
            />
          )}

          {/* STYLES (Gaya Respons) */}
          {activeTab === "styles" && (
            <StylesTab
              styles={stylesData.styles}
              onChange={(styles) => setStylesData({ styles })}
              onSave={() => handleSaveConfig("styles")}
              saving={saving}
            />
          )}

          {/* PRICING (Harga & Paket) */}
          {activeTab === "pricing" && (
            <PricingTab
              pricing={pricingData}
              onChange={setPricingData}
              onSave={handleSavePricing}
              saving={saving}
              pushToast={pushToast}
            />
          )}

          {/* IDENTITY */}
          {activeTab === "identity" && (
            <IdentityTab
              data={identityData}
              onChange={setIdentityData}
              onSave={() => handleSaveConfig("identity")}
              saving={saving}
            />
          )}

          {/* PERSONAL */}
          {activeTab === "personal" && (
            <PersonalTab
              data={personalData}
              onChange={setPersonalData}
              onSave={() => handleSaveConfig("personal")}
              saving={saving}
            />
          )}

          {/* KNOWLEDGE */}
          {activeTab === "knowledge" && (
            <KnowledgeTab
              categories={knowledgeCategories}
              entries={knowledgeEntries}
              selectedCategorySlug={selectedCategorySlug}
              onSelectCategory={setSelectedCategorySlug}
              onAddEntry={() => {
                setEntryForm({ id: "", title: "", content: "", category_id: "" });
                setNewEntryModal(true);
              }}
              onDeleteEntry={handleDeleteKnowledgeEntry}
            />
          )}

          {/* PERSONALITY */}
          {activeTab === "personality" && (
            <PersonalityTab
              data={personalityData}
              onChange={setPersonalityData}
              onSave={() => handleSaveConfig("personality")}
              saving={saving}
            />
          )}

          {/* COMMUNICATION */}
          {activeTab === "communication" && (
            <CommunicationTab
              data={commData}
              onChange={setCommData}
              onSave={() => handleSaveConfig("communication")}
              saving={saving}
            />
          )}

          {/* INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <InstructionsTab
              data={sysData}
              onChange={setSysData}
              onSave={() => handleSaveConfig("instructions")}
              saving={saving}
            />
          )}
        </div>
      </main>

      <KnowledgeEntryModal
        open={newEntryModal}
        onOpenChange={setNewEntryModal}
        entryForm={entryForm}
        setEntryForm={setEntryForm}
        onSave={handleSaveKnowledgeEntry}
        saving={entrySaving}
        categories={knowledgeCategories}
        selectedCategorySlug={selectedCategorySlug}
        setSelectedCategorySlug={setSelectedCategorySlug}
      />

      <JsonImportModal
        open={showJsonModal}
        onOpenChange={setShowJsonModal}
        jsonText={jsonText}
        setJsonText={setJsonText}
        jsonError={jsonError}
        setJsonError={setJsonError}
        jsonDrag={jsonDrag}
        setJsonDrag={setJsonDrag}
        jsonFileRef={jsonFileRef}
        handleBulkDownloadExample={handleBulkDownloadExample}
        handleJsonApplyFromText={handleJsonApplyFromText}
        handleJsonFile={handleJsonFile}
        applyImportedDataToState={applyImportedDataToState}
        setSaveSuccess={setSaveSuccess}
        saving={saving}
      />
    </div>
  );
}
