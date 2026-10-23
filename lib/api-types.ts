/**
 * Tipe data bentuk response backend (FastAPI) yang dipakai lintas halaman.
 * Semua field backend yang opsional menjadi `?:` agar assert cast tidak diperlukan.
 */

/* ---- auth / user ---- */

export interface LoginResponse {
  email_verified?: boolean;
  email?: string;
}

/** Status kuota dari backend (`GET /api/python/user/me#daily_quota`). */
export interface DailyQuota {
  mode: "daily" | "legacy" | "unlimited" | "expired";
  plan_id?: string | null;
  plan_label?: string | null;
  daily_limit?: number | null;
  used_today?: number | null;
  remaining?: number | null;
  quota_day?: string | null;
  next_reset_wib?: string | null;
}

/** Response `/api/python/user/me`. */
export interface Me {
  username: string;
  display_name?: string | null;
  email?: string | null;
  email_verified?: boolean;
  max_prompts: number;
  prompts_used: number;
  remaining: number | null;
  daily_quota?: DailyQuota | null;
  has_password?: boolean;
  goal?: string;
  style_id?: string;
  gender?: string;
}

/** Response `/api/python/trial`. */
export interface TrialInfo {
  trial_prompts: number;
  used: number;
  remaining: number;
  allowed: boolean;
}

/* ---- users ---- */

export interface AdminUserQuota {
  mode: "daily" | "legacy" | "unlimited" | "expired";
  plan_id?: string | null;
  plan_label?: string | null;
  /** "plan" (paket paid) | "manual" (grant admin) | "default" (kuota default) | "unlimited" */
  plan_source?: "plan" | "manual" | "default" | "unlimited" | null;
  /** true = langganan/mendapat kuota khusus; false = tidak berlangganan (kuota default). */
  subscribed?: boolean | null;
  daily_limit?: number | null;
  used_today?: number | null;
  remaining?: number | null;
  quota_day?: string | null;
  next_reset_wib?: string | null;
  plan_expires_at?: string | null;
  plan_days_left?: number | null;
}

export interface AdminUser {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  email_verified?: boolean;
  max_prompts: number;
  prompts_used?: number;
  is_active?: boolean;
  unlimited?: boolean;
  /** Status kuota harian dari backend (sumber kebenaran, bukan max_prompts). */
  quota?: AdminUserQuota | null;
  plan_label?: string | null;
  plan_source?: AdminUserQuota["plan_source"];
  subscribed?: boolean | null;
  plan_expires_at?: string | null;
  plan_days_left?: number | null;
  daily_limit?: number | null;
  daily_used?: number | null;
  daily_remaining?: number | null;
  quota_mode?: AdminUserQuota["mode"] | null;
  quota_day?: string | null;
  quota_reset?: string | null;
  /** Grant kuota manual admin (null = tidak ada). */
  manual_daily_limit?: number | null;
  manual_plan_label?: string | null;
  manual_expires_at?: string | null;
  provider?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Ringkasan paket pricing untuk dropdown grant manual (lihat PricingPlan). */
export type PricingPlanSummary = Pick<PricingPlan, "id" | "label" | "prompts" | "days">;

/* ---- knowledge base ---- */

export interface KnowledgeCategory {
  id: string;
  slug: string;
  name: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category_id: string;
  category_slug?: string;
  tags?: string[];
  is_active?: boolean;
}

/* ---- model catalog ---- */

export interface ModelCatalogEntry {
  id: string;
  name?: string | null;
  description?: string | null;
  context_length?: number | string | null;
  pricing?: {
    prompt?: number | string | null;
    completion?: number | string | null;
    [key: string]: unknown;
  };
}

/* ---- admin: health / audit / settings ---- */

export interface AdminHealth {
  database?: { ok?: boolean | null; mode?: string | null };
  token_budget?: { today: number; budget: number; remaining: number | null };
  last_login_failure?: {
    created_at?: string | null;
    actor?: string | null;
    detail?: string | null;
  };
}

export interface AuditRow {
  created_at?: string | null;
  actor?: string | null;
  action?: string | null;
  target?: string | null;
  detail?: string | null;
  ip?: string | null;
}

/** Bentuk mentah object settings dari backend (nilai masih mixed). */
export interface AppSettingsRaw {
  user_token_expiry_hours?: number | string | null;
  trial_prompts?: number | string | null;
  rag_match_count_short?: number | string | null;
  rag_match_count_long?: number | string | null;
  rag_match_threshold?: number | string | null;
  [key: string]: unknown;
}

/* ---- admin: konfigurasi persona/styles/pricing ---- */

export interface IdentityConfig {
  name: string;
  role: string;
  description: string;
  identity: string;
  purpose: string;
}

export interface PersonalConfig {
  profile: string;
  background: string;
  interests: string;
  experience: string;
  projects: string;
  preferences: string;
  relevant_context: string;
}

export interface PersonalityConfig {
  personality: string;
  tone: string;
  attitude: string;
  reasoning_style: string;
  criticism_style: string;
  response_behavior: string;
  prohibited_behavior: string;
}

export interface CommunicationConfig {
  primary_language: string;
  tone: string;
  response_length: string;
  formatting_preference: string;
  technical_depth: string;
  explanation_style: string;
}

export interface SystemConfig {
  behavioral_rules: string;
  response_rules: string;
  safety_rules: string;
  knowledge_priority: string;
  reasoning_constraints: string;
  formatting_rules: string;
}

export interface StyleConfig {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface PricingPlan {
  id: string;
  label: string;
  prompts: number;
  /** Masa aktif dalam hari; 0/kosong = tanpa batas waktu. */
  days?: number | null;
  amount: number;
  popular: boolean;
  original_amount?: number | string | null;
}

export interface PricingData {
  default_daily_prompts?: number;
  plans: PricingPlan[];
  payment_qris: string;
  payment_instructions: string;
  contact: string;
  order_note: string;
}

/* ---- admin: bootstrap (gabungan semua data panel) ---- */

export interface ModelConfigRaw {
  active_model?: string;
  fallback_models?: string[];
  provider?: string;
  api_base_url?: string;
  temperature?: number | string;
  reasoning_enabled?: boolean;
  max_tokens?: number | string;
  [key: string]: unknown;
}

export interface AdminBootstrapConfig {
  identity?: IdentityConfig;
  personal?: PersonalConfig;
  personality?: PersonalityConfig;
  communication?: CommunicationConfig;
  system?: SystemConfig;
  response_styles?: { styles?: StyleConfig[] };
  pricing?: PricingData;
}

export interface AdminModelsPayload extends ModelConfigRaw {
  current?: ModelConfigRaw;
  live_catalog?: {
    data?: ModelCatalogEntry[];
    fallback?: { data?: ModelCatalogEntry[] };
    error?: unknown;
  };
}

export interface AdminBootstrap {
  config?: AdminBootstrapConfig;
  categories?: KnowledgeCategory[];
  entries?: KnowledgeEntry[];
  models?: AdminModelsPayload;
  users?: AdminUser[];
  /** Bisa berbentuk flat (object settings) atau nested `{ settings: ... }`. */
  settings?: { settings?: AppSettingsRaw };
}

/* ---- admin: token usage ---- */

export interface TokenUsageDaily {
  day?: string | null;
  prompt?: number;
  completion?: number;
  total: number;
}

export interface TokenUsageByUserRow {
  owner?: string | null;
  label?: string | null;
  kind?: string | null;
  today?: number;
  prompt?: number;
  completion?: number;
  total?: number;
  share?: number;
  prompts_used?: number;
  max_prompts?: number | null;
}

/** Response `/api/python/admin/token-usage`. */
export interface TokenUsageStats {
  budget?: number;
  daily?: TokenUsageDaily[];
  today?: { prompt?: number; completion?: number; total?: number };
  yesterday?: { prompt?: number; completion?: number; total?: number };
  total?: { prompt?: number; completion?: number; total?: number };
  remaining?: number | null;
  by_user?: TokenUsageByUserRow[];
}

/* ---- admin: shared UI types untuk hook admin ---- */

/** Jenis toast AdminPanel. */
export type AdminToastKind = "success" | "error" | "info";

/** Bentuk pushToast AdminPanel, dipakai lintas hook admin (Phase A). */
export type AdminPushToast = (kind: AdminToastKind, title: string, desc?: string) => void;

/* ---- admin: bulk import/export ---- */

export interface KnowledgeExportEntry {
  id?: string;
  category_slug?: string;
  category_id?: string;
  title: string;
  content: string;
  tags?: string[];
  is_active: boolean;
}

export interface AdminExportPayload {
  version: number;
  exported_at: string;
  ai_identity: IdentityConfig;
  personal_information: PersonalConfig;
  ai_personality: PersonalityConfig;
  communication_settings: CommunicationConfig;
  system_instructions: SystemConfig;
  knowledge_entries: KnowledgeExportEntry[];
}

/** Payload JSON hasil paste/upload pada modal bulk import. */
export interface AdminImportData {
  ai_identity?: Partial<IdentityConfig>;
  personal_information?: Partial<PersonalConfig>;
  ai_personality?: Partial<PersonalityConfig>;
  communication_settings?: Partial<CommunicationConfig>;
  system_instructions?: Partial<SystemConfig>;
  knowledge_entries?: KnowledgeExportEntry[];
  [key: string]: unknown;
}

export interface AdminImportResult {
  errors?: unknown;
  applied_sections?: string[];
  knowledge_entries_applied?: number;
  [key: string]: unknown;
}
