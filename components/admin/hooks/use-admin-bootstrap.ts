/**
 * Hook data admin - bootstrap / auth / health / config / model / JSON import-export.
 *
 * Diekstrak dari AdminPanel.tsx (Phase A); logika & bentuk payload tidak diubah.
 *
 * Deps:
 * - `authExpired`            : guard redirect login saat 401 (dari AdminPanel).
 * - `pushToast`              : notifikasi UI AdminPanel.
 * - `router`                 : untuk checkAuth / logout -> /admin/login.
 * - `setUsers` / `setUsersLoading` / `setAppSettings` : setter dari useAdminUsers
 *   (hook users dibuat lebih dulu di AdminPanel).
 * - `onBootstrapKnowledge`   : callback ke useAdminKnowledge.ingestBootstrap,
 *   memuat kategori/entry/categoryData hasil bootstrap payload.
 * - `knowledgeEntries` / `knowledgeCategories` : untuk build export JSON lokal
 *   (fallback kalau fetch export gagal).
 *
 * Mengembalikan state auth/health/audit/config/model/JSON-modal beserta setter
 * dan aksi simpannya. Fungsi yang butuh lintas-hook (refresh-all, dsb.) tetap
 * masuk via parameter, tidak direstrukturisasi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchApi, tryFetch } from "@/lib/fetch-api";
import type {
  AdminBootstrap,
  AdminExportPayload,
  AdminHealth,
  AdminImportData,
  AdminImportResult,
  AdminPushToast,
  AdminUser,
  AppSettingsRaw,
  AuditRow,
  CommunicationConfig,
  IdentityConfig,
  KnowledgeCategory,
  KnowledgeEntry,
  ModelCatalogEntry,
  PersonalConfig,
  PersonalityConfig,
  PricingData,
  StyleConfig,
  SystemConfig,
} from "@/lib/api-types";
import type { AppSettingsSetter } from "./use-admin-users";

export type TabType =
  | "dashboard"
  | "users"
  | "identity"
  | "personal"
  | "knowledge"
  | "personality"
  | "communication"
  | "instructions"
  | "models"
  | "styles"
  | "pricing";

export type AdminBootstrapDeps = {
  authExpired: (status: number) => boolean;
  pushToast: AdminPushToast;
  router: { replace: (url: string) => void };
  setUsers: (value: AdminUser[]) => void;
  setUsersLoading: (value: boolean) => void;
  setAppSettings: AppSettingsSetter;
  onBootstrapKnowledge: (b: AdminBootstrap) => void;
  knowledgeEntries: KnowledgeEntry[];
  knowledgeCategories: KnowledgeCategory[];
};

export function useAdminBootstrap({
  authExpired,
  pushToast,
  router,
  setUsers,
  setUsersLoading,
  setAppSettings,
  onBootstrapKnowledge,
  knowledgeEntries,
  knowledgeCategories,
}: AdminBootstrapDeps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [identityData, setIdentityData] = useState<IdentityConfig>({
    name: "",
    role: "",
    description: "",
    identity: "",
    purpose: "",
  });
  const [personalData, setPersonalData] = useState<PersonalConfig>({
    profile: "",
    background: "",
    interests: "",
    experience: "",
    projects: "",
    preferences: "",
    relevant_context: "",
  });
  const [personalityData, setPersonalityData] = useState<PersonalityConfig>({
    personality: "",
    tone: "",
    attitude: "",
    reasoning_style: "",
    criticism_style: "",
    response_behavior: "",
    prohibited_behavior: "",
  });
  const [commData, setCommData] = useState<CommunicationConfig>({
    primary_language: "",
    tone: "",
    response_length: "",
    formatting_preference: "",
    technical_depth: "",
    explanation_style: "",
  });
  const [sysData, setSysData] = useState<SystemConfig>({
    behavioral_rules: "",
    response_rules: "",
    safety_rules: "",
    knowledge_priority: "",
    reasoning_constraints: "",
    formatting_rules: "",
  });
  const [stylesData, setStylesData] = useState<{ styles: StyleConfig[] }>({ styles: [] });
  const [pricingData, setPricingData] = useState<PricingData>({
    plans: [],
    payment_qris: "",
    payment_instructions: "",
    contact: "",
    order_note: "",
  });

  const [modelConfig, setModelConfig] = useState({
    active_model: "",
    fallback_models: [] as string[],
    provider: "openrouter",
    api_base_url: "https://openrouter.ai/api/v1",
    temperature: 0.4,
    reasoning_enabled: false,
    max_tokens: 8192,
  });
  const [availableModels, setAvailableModels] = useState<ModelCatalogEntry[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [fallbackInput, setFallbackInput] = useState("");
  const [catalogApiKey, setCatalogApiKey] = useState("");
  const [catalogBaseUrl, setCatalogBaseUrl] = useState("");
  const [showCatalogKey, setShowCatalogKey] = useState(false);
  const [modelTestResults, setModelTestResults] = useState<
    Record<
      string,
      { status: "ok" | "error" | "loading"; latency_ms?: number; sample?: string; error?: string }
    >
  >({});

  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonDrag, setJsonDrag] = useState(false);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  /* Muat bootstrap: config persona, knowledge, model config, users, settings. */
  const loadAllData = async () => {
    setUsersLoading(true);
    try {
      const b = await fetchApi<AdminBootstrap>(
        "/api/python/admin/bootstrap?include_catalog=0",
        {},
        { fallbackError: "Gagal memuat data admin" },
      );

      const c = b.config || {};
      if (c.identity) setIdentityData(c.identity);
      if (c.personal) setPersonalData(c.personal);
      if (c.personality) setPersonalityData(c.personality);
      if (c.communication) setCommData(c.communication);
      if (c.system) setSysData(c.system);
      if (Array.isArray(c.response_styles?.styles)) {
        const styles = c.response_styles.styles;
        setStylesData({ styles });
      }
      if (c.pricing) {
        setPricingData({
          plans: Array.isArray(c.pricing.plans) ? c.pricing.plans : [],
          payment_qris: c.pricing.payment_qris || "",
          payment_instructions: c.pricing.payment_instructions || "",
          contact: c.pricing.contact || "",
          order_note: c.pricing.order_note || "",
        });
      }

      onBootstrapKnowledge(b);

      const m = b.models || {};
      const cur = m.current || m;
      setModelConfig({
        active_model: cur.active_model || "",
        fallback_models: (cur.fallback_models || []).map((s) => String(s)),
        provider: cur.provider || "openrouter",
        api_base_url: cur.api_base_url || "https://openrouter.ai/api/v1",
        temperature: Number(cur.temperature ?? 0.4),
        reasoning_enabled: Boolean(cur.reasoning_enabled),
        max_tokens: Number(cur.max_tokens) || 8192,
      });
      const cat = m.live_catalog?.data || m.live_catalog?.fallback?.data || [];
      if (Array.isArray(cat) && cat.length) setAvailableModels(cat);

      setUsers(Array.isArray(b.users) ? b.users : []);
      const s = b.settings?.settings || b.settings || {};
      setAppSettings(parseAppSettingsBoot(s as AppSettingsRaw));
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Cookie admin (itz_admin_token) expire tiap 2h. Kalau panel dibiarkan
  // terbuka lewat expiry, semua save balik 401 "No token provided".
  // Guard ini redirect ke login alih-alih menampilkan error membingungkan.
  const checkAuth = async () => {
    try {
      const r = await tryFetch("/api/python/admin/verify");
      if (r.ok) {
        setIsAuthenticated(true);
        loadAllData();
      } else {
        router.replace("/admin/login");
      }
    } catch {}
    setIsLoadingAuth(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await fetchApi("/api/python/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  };

  const loadHealth = useCallback(async () => {
    try {
      const j = await fetchApi<AdminHealth>("/api/python/admin/health");
      setHealth(j);
      setHealthError(false);
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      setHealthError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const j = await fetchApi<{ items?: AuditRow[] }>("/api/python/admin/audit?limit=100");
      setAuditRows(j.items || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHealth();
    loadAudit();
    const t = window.setInterval(loadHealth, 30000);
    return () => window.clearInterval(t);
  }, [isAuthenticated, loadHealth, loadAudit]);

  const refreshAvailableModels = async (opts?: { freeOnly?: boolean }) => {
    setModelsLoading(true);
    try {
      const fo = opts?.freeOnly ?? freeOnly;
      let data: ModelCatalogEntry[] | null = null;
      if (catalogApiKey.trim() || catalogBaseUrl.trim()) {
        try {
          const j = await fetchApi<{ data?: ModelCatalogEntry[]; error?: unknown }>(
            "/api/python/admin/models/catalog",
            {
              method: "POST",
              json: {
                api_key: catalogApiKey.trim() || undefined,
                base_url: catalogBaseUrl.trim() || undefined,
                include_free_only: fo,
                limit: 120,
              },
            },
          );
          if (Array.isArray(j.data) && j.data.length) {
            setAvailableModels(j.data);
            data = j.data;
          }
          if (j.error) pushToast("error", "Katalog gagal", String(j.error).slice(0, 160));
        } catch (e) {
          // Koneksi terputus: hanya dicatat di console, sama seperti versi lama.
          if (!(e instanceof ApiError) || e.status === 0) throw e;
          const j = (e.data ?? {}) as { detail?: unknown; error?: unknown };
          const msg = j.detail || j.error || "Katalog gagal";
          pushToast(
            "error",
            "Katalog gagal",
            typeof msg === "string" ? msg.slice(0, 160) : JSON.stringify(msg).slice(0, 160),
          );
        }
      } else {
        const params = new URLSearchParams({ include_free_only: String(fo), limit: "120" });
        let j: {
          live_catalog?: {
            data?: ModelCatalogEntry[];
            fallback?: { data?: ModelCatalogEntry[] };
            error?: unknown;
          };
          data?: ModelCatalogEntry[];
        } | null = null;
        try {
          j = await fetchApi<{
            live_catalog?: {
              data?: ModelCatalogEntry[];
              fallback?: { data?: ModelCatalogEntry[] };
              error?: unknown;
            };
            data?: ModelCatalogEntry[];
          }>(`/api/python/admin/models?${params.toString()}`);
        } catch {}
        if (j) {
          data = j.live_catalog?.data || j.live_catalog?.fallback?.data || j.data || null;
          if (Array.isArray(data)) setAvailableModels(data);
          if (j.live_catalog?.error)
            pushToast("error", "Katalog gagal", String(j.live_catalog.error).slice(0, 160));
        }
        if (!data || !Array.isArray(data) || data.length === 0) {
          let j2: { data?: ModelCatalogEntry[]; fallback?: { data?: ModelCatalogEntry[] } } | null =
            null;
          try {
            j2 = await fetchApi<{
              data?: ModelCatalogEntry[];
              fallback?: { data?: ModelCatalogEntry[] };
            }>(`/api/python/v1/models/available?limit=120&include_free_only=${fo}`);
          } catch {}
          if (j2) {
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
      const body: { model: string; api_key?: string; base_url?: string; provider?: string } = {
        model: id,
      };
      if (catalogApiKey.trim()) body.api_key = catalogApiKey.trim();
      if (catalogBaseUrl.trim()) body.base_url = catalogBaseUrl.trim();
      if (modelConfig.provider) body.provider = modelConfig.provider;
      const j = await fetchApi<{
        status?: string;
        latency_ms?: number;
        sample?: string;
        detail?: { error?: unknown; latency_ms?: number };
        error?: unknown;
      }>("/api/python/admin/models/test", { json: body });
      if (j.status === "ok") {
        setModelTestResults((prev) => ({
          ...prev,
          [id]: { status: "ok", latency_ms: j.latency_ms, sample: j.sample },
        }));
        pushToast("success", "Model OK", `${id.slice(0, 40)} · ${j.latency_ms}ms`);
      } else {
        const err = (j.detail?.error || j.detail || j.error || "Gagal") as string;
        const latency = j.detail?.latency_ms ?? j.latency_ms;
        setModelTestResults((prev) => ({
          ...prev,
          [id]: {
            status: "error",
            latency_ms: latency,
            error: typeof err === "string" ? err : JSON.stringify(err),
          },
        }));
        pushToast(
          "error",
          "Model gagal",
          typeof err === "string" ? err.slice(0, 160) : "Cek kredensial / model",
        );
      }
    } catch (e) {
      const msg0 = (e instanceof Error ? e.message : "") || String(e);
      // HTTP gagal: bentuk error sama seperti branch gagal versi lama (detail/latency).
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as {
          detail?: { error?: unknown; latency_ms?: number };
          error?: unknown;
        };
        const err = (d.detail?.error || d.detail || d.error || "Gagal") as string;
        const latency = d.detail?.latency_ms;
        setModelTestResults((prev) => ({
          ...prev,
          [id]: {
            status: "error",
            latency_ms: latency,
            error: typeof err === "string" ? err : JSON.stringify(err),
          },
        }));
        pushToast(
          "error",
          "Model gagal",
          typeof err === "string" ? err.slice(0, 160) : "Cek kredensial / model",
        );
        return;
      }
      setModelTestResults((prev) => ({
        ...prev,
        [id]: { status: "error", error: msg0 },
      }));
      pushToast("error", "Model gagal", msg0.slice(0, 160));
    }
  };

  const handleSaveModelConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage("");
    try {
      const j = await fetchApi<{
        data?: Partial<typeof modelConfig>;
        current?: Partial<typeof modelConfig>;
        active_model?: string;
      }>("/api/python/admin/models", {
        method: "PUT",
        json: {
          active_model: modelConfig.active_model,
          fallback_models: modelConfig.fallback_models,
          provider: modelConfig.provider,
          api_base_url: modelConfig.api_base_url,
          temperature: modelConfig.temperature,
          reasoning_enabled: modelConfig.reasoning_enabled,
          max_tokens: modelConfig.max_tokens,
        },
      });
      const cur = j.data || j.current || modelConfig;
      setModelConfig((prev) => ({ ...prev, ...cur }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      pushToast(
        "success",
        "Model diperbarui",
        (cur.active_model || modelConfig.active_model || "").slice(0, 80),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        if (authExpired(e.status)) return;
        const d = (e.data ?? {}) as { detail?: unknown };
        const msg = d.detail || "Gagal menyimpan model config";
        setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
        pushToast(
          "error",
          "Gagal simpan model",
          typeof msg === "string" ? msg.slice(0, 120) : "Periksa input.",
        );
      } else {
        const err = e as { message?: string };
        const msg = err.message || "Error saving model config";
        setErrorMessage(msg);
        pushToast("error", "Gagal simpan model", msg.slice(0, 120));
      }
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
    else if (section === "styles") payloadData = stylesData;
    const tableMap: Record<string, string> = {
      identity: "ai_identity",
      personal: "personal_information",
      personality: "ai_personality",
      communication: "communication_settings",
      instructions: "system_instructions",
      styles: "response_styles",
    };
    const labelMap: Record<string, string> = {
      identity: "Identitas",
      personal: "Info Personal",
      personality: "Kepribadian",
      communication: "Komunikasi",
      instructions: "Instruksi",
      styles: "Gaya Respons",
    };
    try {
      await fetchApi("/api/python/admin/config", {
        method: "PUT",
        json: { section: tableMap[section], data: payloadData },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      pushToast("success", "Tersimpan", `${labelMap[section] ?? section} diperbarui.`);
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        if (authExpired(e.status)) return;
        const d = (e.data ?? {}) as { detail?: unknown };
        const msg = d.detail || "Gagal menyimpan konfigurasi";
        const str = typeof msg === "string" ? msg : JSON.stringify(msg);
        setErrorMessage(str);
        pushToast("error", "Gagal simpan", str.slice(0, 120));
      } else {
        const err = e as { message?: string };
        const msg = err.message || "Error saving configuration";
        setErrorMessage(msg);
        pushToast("error", "Gagal simpan", msg.slice(0, 120));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      const j = await fetchApi<{
        pricing?: {
          plans?: {
            id: string;
            label: string;
            prompts: number;
            days?: number | null;
            amount: number;
            popular: boolean;
            original_amount?: number | null;
          }[];
          payment_qris?: string;
          payment_instructions?: string;
          contact?: string;
          order_note?: string;
        };
      }>("/api/python/admin/pricing", {
        method: "PUT",
        json: pricingData,
      });
      if (j.pricing) {
        setPricingData({
          plans: Array.isArray(j.pricing.plans) ? j.pricing.plans : [],
          payment_qris: j.pricing.payment_qris || "",
          payment_instructions: j.pricing.payment_instructions || "",
          contact: j.pricing.contact || "",
          order_note: j.pricing.order_note || "",
        });
      }
      pushToast("success", "Tersimpan", "Harga & paket diperbarui.");
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        if (authExpired(e.status)) return;
        const d = (e.data ?? {}) as { detail?: unknown };
        const str = typeof d.detail === "string" ? d.detail : `Gagal menyimpan (HTTP ${e.status})`;
        pushToast("error", "Gagal simpan", str.slice(0, 160));
      } else {
        pushToast("error", "Gagal simpan", "Tidak bisa menghubungi backend");
      }
    } finally {
      setSaving(false);
    }
  };

  const buildLocalExportBlob = () => {
    const exportObj: AdminExportPayload = {
      version: 1,
      exported_at: new Date().toISOString(),
      ai_identity: identityData,
      personal_information: personalData,
      ai_personality: personalityData,
      communication_settings: commData,
      system_instructions: sysData,
      knowledge_entries: knowledgeEntries.map((e) => ({
        id: e.id,
        category_slug:
          knowledgeCategories.find((c) => c.id === e.category_id)?.slug ||
          e.category_slug ||
          undefined,
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

  const applyImportedDataToState = (data: AdminImportData) => {
    if (data.ai_identity) setIdentityData((prev) => ({ ...prev, ...data.ai_identity }));
    if (data.personal_information)
      setPersonalData((prev) => ({ ...prev, ...data.personal_information }));
    if (data.ai_personality) setPersonalityData((prev) => ({ ...prev, ...data.ai_personality }));
    if (data.communication_settings)
      setCommData((prev) => ({ ...prev, ...data.communication_settings }));
    if (data.system_instructions) setSysData((prev) => ({ ...prev, ...data.system_instructions }));
  };

  const handleJsonApplyFromText = async () => {
    setJsonError("");
    let data: AdminImportData;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      const msg = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
      setJsonError(msg);
      pushToast("error", "JSON tidak valid", msg.slice(0, 120));
      return;
    }
    applyImportedDataToState(data);
    setSaving(true);
    try {
      let j: AdminImportResult = {};
      try {
        j = await fetchApi<AdminImportResult>("/api/python/admin/import", {
          method: "POST",
          json: data,
        });
      } catch (e) {
        // HTTP gagal / koneksi terputus: bentuk pesan sama seperti versi lama.
        if (!(e instanceof ApiError)) throw e;
        const j2 = (e.data ?? {}) as Record<string, unknown>;
        const msg = j2.detail || j2.message || e.data;
        const str = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
        setJsonError(str);
        setSaveSuccess(false);
        pushToast("error", "Import gagal", str.slice(0, 120));
        return;
      }
      if (j.errors) {
        const errStr = JSON.stringify(j.errors, null, 2);
        setJsonError(`Partial import - some sections failed:\n${errStr}`);
        pushToast("info", "Import sebagian", "Beberapa section gagal - cek detail.");
      } else {
        pushToast(
          "success",
          "Import berhasil",
          `${j.applied_sections?.length || 0} section + ${j.knowledge_entries_applied || 0} knowledge diterapkan.`,
        );
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadAllData();
      setTimeout(() => setShowJsonModal(false), 700);
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : "") || String(e)) as string;
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
    } catch (e) {
      setJsonError(((e instanceof Error ? e.message : "") || String(e)) as string);
    }
  };

  const openJsonModalWithPrefill = async () => {
    try {
      const j = await fetchApi("/api/python/admin/export");
      setJsonText(JSON.stringify(j, null, 2));
      setJsonError("");
      setShowJsonModal(true);
      return;
    } catch {}
    setJsonText(
      JSON.stringify(
        JSON.parse(
          new TextDecoder().decode(
            new TextEncoder().encode(
              JSON.stringify({
                ai_identity: identityData,
                personal_information: personalData,
                ai_personality: personalityData,
                communication_settings: commData,
                system_instructions: sysData,
                knowledge_entries: knowledgeEntries.slice(0, 50).map((e) => ({
                  category_slug:
                    knowledgeCategories.find((c) => c.id === e.category_id)?.slug || undefined,
                  title: e.title,
                  content: e.content,
                  tags: e.tags || [],
                  is_active: e.is_active ?? true,
                })),
              }),
            ),
          ),
        ),
        null,
        2,
      ),
    );
    setJsonError("");
    setShowJsonModal(true);
  };

  return {
    isAuthenticated,
    setIsAuthenticated,
    isLoadingAuth,
    health,
    setHealth,
    healthError,
    auditRows,
    loadAudit,
    saving,
    saveSuccess,
    setSaveSuccess,
    errorMessage,
    setErrorMessage,
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
    loadHealth,
    handleLogout,
    loadAllData,
    refreshAvailableModels,
    handleTestModel,
    handleSaveModelConfig,
    handleSaveConfig,
    handleSavePricing,
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
  };
}

export type AdminBootstrapApi = ReturnType<typeof useAdminBootstrap>;

/** parseAppSettings dipindah utuh dari AdminPanel; karena file users juga
 * memakainya via hook users, bentuknya diulang setempat tanpa mengubah logika. */
function parseAppSettingsBoot(s: AppSettingsRaw) {
  const threshold = s.rag_match_threshold;
  return {
    user_token_expiry_hours: Number(s.user_token_expiry_hours ?? 24),
    trial_prompts: Number(s.trial_prompts ?? 3),
    rag_match_count_short: Number(s.rag_match_count_short ?? 6),
    rag_match_count_long: Number(s.rag_match_count_long ?? 8),
    rag_match_threshold:
      threshold === null || threshold === undefined || threshold === "" ? null : Number(threshold),
  };
}
