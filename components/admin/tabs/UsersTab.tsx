"use client";

/**
 * Tab Users AdminPanel.
 *
 * Diekstrak dari AdminPanel.tsx (Phase B); markup & logika dipindah apa adanya.
 * Menerima data/aksi via props eksplisit (bukan objek hook) dari AdminPanel.
 */

import React, { type Dispatch, type FormEvent, type SetStateAction } from "react";
import { AlertCircle, Check, Loader2, Plus, RefreshCw, Save, Stamp, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "../SectionHeader";
import { FieldInfo } from "../FieldInfo";
import {
  cardBase,
  cardHeaderCls,
  cardContentCls,
  tSub,
  tCardPlain,
  tLabelPlain,
  cUser,
  inputCls,
} from "../adminStyles";
import { fmtDateTime } from "../lib-helpers";
import type { AdminUser, PricingPlanSummary } from "@/lib/api-types";
import type { AppSettings, AppSettingsSetter } from "../hooks/use-admin-users";

export type ManualQuotaPayload = {
  prompts: number;
  plan_id?: string | null;
  days?: number;
  label?: string | null;
};

export type UserFormState = {
  username: string;
  password: string;
  display_name: string;
  is_active: boolean;
  unlimited: boolean;
};

export type GrantFormState = {
  plan_id: string;
  prompts: string;
  days: string;
  label: string;
};

export type UsersTabProps = {
  users: AdminUser[];
  usersLoading: boolean;
  syncingUsers: boolean;
  appSettings: AppSettings;
  setAppSettings: AppSettingsSetter;
  /** Paket dari tab Pricing (default kuota, kuota paket) untuk grant manual. */
  plans: PricingPlanSummary[];
  onSaveSettings: () => Promise<void>;
  onSyncLocalUsers: () => Promise<void>;
  userModalOpen: boolean;
  setUserModalOpen: Dispatch<SetStateAction<boolean>>;
  savingUser: boolean;
  savingSettings: boolean;
  editingUserId: string | null;
  setEditingUserId: Dispatch<SetStateAction<string | null>>;
  userForm: UserFormState;
  setUserForm: Dispatch<SetStateAction<UserFormState>>;
  grantForm: GrantFormState;
  setGrantForm: Dispatch<SetStateAction<GrantFormState>>;
  onSubmitUser: (e: FormEvent) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onResetUsage: (id: string) => Promise<void>;
  onGrantQuota: (id: string, body: ManualQuotaPayload) => Promise<void>;
  onClearQuota: (id: string) => Promise<void>;
};

export function UsersTab({
  users,
  usersLoading,
  syncingUsers,
  appSettings,
  setAppSettings,
  plans,
  onSaveSettings: handleSaveSettings,
  onSyncLocalUsers: handleSyncLocalUsers,
  userModalOpen,
  setUserModalOpen,
  savingUser,
  savingSettings,
  editingUserId,
  setEditingUserId,
  userForm,
  setUserForm,
  grantForm,
  setGrantForm,
  onSubmitUser: handleCreateOrUpdateUser,
  onDeleteUser: handleDeleteUser,
  onResetUsage: handleResetUsage,
  onGrantQuota: handleGrantQuota,
  onClearQuota: handleClearQuota,
}: UsersTabProps) {
  const editingUser = editingUserId
    ? users.find((u) => String(u.id) === String(editingUserId))
    : null;
  const submitGrant = async () => {
    if (!editingUserId) return;
    const prompts = Math.floor(Number(grantForm.prompts));
    if (!Number.isFinite(prompts) || prompts <= 0) return;
    const selected = plans.find((p) => String(p.id) === grantForm.plan_id);
    await handleGrantQuota(editingUserId, {
      prompts,
      plan_id: grantForm.plan_id || null,
      days: Math.max(0, Math.floor(Number(grantForm.days) || 0)),
      label: grantForm.label.trim() || (selected ? `${selected.label} (manual)` : "Kuota manual"),
    });
  };
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <SectionHeader
        title="Users"
        desc="Kelola akun pengguna, batas prompt, dan pengaturan akses."
      />

      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCardPlain}>Pengaturan</CardTitle>
        </CardHeader>
        <CardContent className={`${cardContentCls} flex flex-wrap items-end gap-4`}>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className={tLabelPlain}>Expiry token user (jam)</Label>
              <FieldInfo text="Masa berlaku token login user, dalam jam. Berlaku untuk login baru setelah disimpan." />
            </div>
            <Input
              type="number"
              min={1}
              max={720}
              value={appSettings.user_token_expiry_hours}
              onChange={(e) =>
                setAppSettings((p) => ({
                  ...p,
                  user_token_expiry_hours: Number(e.target.value),
                }))
              }
              className={`${inputCls} w-32`}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className={tLabelPlain}>Trial prompts (0=matikan trial)</Label>
              <FieldInfo text="Jumlah prompt gratis untuk trial per IP. Setelah habis, hit berikutnya wajib login. Isi 0 untuk mematikan trial." />
            </div>
            <Input
              type="number"
              min={0}
              max={100}
              value={appSettings.trial_prompts}
              onChange={(e) =>
                setAppSettings((p) => ({ ...p, trial_prompts: Number(e.target.value) }))
              }
              className={`${inputCls} w-32`}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className={tLabelPlain}>Jumlah chunk RAG (pertanyaan pendek)</Label>
              <FieldInfo text="Berapa banyak potongan knowledge base yang diambil untuk pertanyaan pendek. Berlaku pada chat berikutnya." />
            </div>
            <Input
              type="number"
              min={1}
              max={30}
              value={appSettings.rag_match_count_short}
              onChange={(e) =>
                setAppSettings((p) => ({
                  ...p,
                  rag_match_count_short: Number(e.target.value),
                }))
              }
              className={`${inputCls} w-32`}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className={tLabelPlain}>Jumlah chunk RAG (pertanyaan panjang)</Label>
              <FieldInfo text="Berapa banyak potongan knowledge base yang diambil untuk pertanyaan panjang/kompleks. Berlaku pada chat berikutnya." />
            </div>
            <Input
              type="number"
              min={1}
              max={30}
              value={appSettings.rag_match_count_long}
              onChange={(e) =>
                setAppSettings((p) => ({
                  ...p,
                  rag_match_count_long: Number(e.target.value),
                }))
              }
              className={`${inputCls} w-32`}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className={tLabelPlain}>Threshold similarity (kosong = default env)</Label>
              <FieldInfo text="Batas kemiripan minimum (0–1) agar chunk diambil. Kosong = pakai nilai env MATCH_THRESHOLD di server." />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={appSettings.rag_match_threshold ?? ""}
                placeholder="env"
                onChange={(e) =>
                  setAppSettings((p) => ({
                    ...p,
                    rag_match_threshold: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={`${inputCls} w-32`}
              />
              <Button
                variant="outline"
                onClick={() => setAppSettings((p) => ({ ...p, rag_match_threshold: null }))}
                className="h-9 text-[14px]"
              >
                Reset
              </Button>
            </div>
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="h-9 bg-white text-black hover:bg-zinc-100 gap-1.5 text-[16px] font-medium"
          >
            {savingSettings ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Simpan
          </Button>
          <p className="text-[13px] leading-relaxed text-zinc-500 w-full">
            Expiry berlaku untuk login baru. Trial per IP, hit ke-
            {appSettings.trial_prompts + 1} wajib login. Threshold kosong memakai env
            MATCH_THRESHOLD. Perubahan chunk berlaku pada chat berikutnya.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className={tSub}>Daftar Pengguna</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncLocalUsers}
            disabled={syncingUsers}
            className="h-9 border-white/10 bg-white/[0.04] text-[14px] text-zinc-300 gap-1.5"
          >
            {syncingUsers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}{" "}
            Sinkron user lokal
          </Button>
          <Button
            onClick={() => {
              setEditingUserId(null);
              setUserForm({
                username: "",
                password: "",
                display_name: "",
                is_active: true,
                unlimited: false,
              });
              setGrantForm({ plan_id: "", prompts: "", days: "0", label: "" });
              setUserModalOpen(true);
            }}
            className="h-9 bg-white text-black hover:bg-zinc-100 gap-1.5 text-[16px] font-medium"
          >
            <Plus className="h-4 w-4" /> Tambah User
          </Button>
        </div>
      </div>

      <Card className={`${cardBase} overflow-hidden`}>
        <CardContent className="p-0">
          {usersLoading ? (
            <div className="p-6 text-[16px] text-zinc-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-[16px] text-zinc-500">Belum ada user.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="px-5 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Metode
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Status langganan
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Kuota harian (WIB)
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Dibuat
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Diperbarui
                    </th>
                    <th className="px-5 py-3 text-right text-[12px] font-semibold tracking-[0.08em] text-zinc-500">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {users.map((u) => {
                    // Unlimited HANYA flag admin; max_prompts legacy 0 tidak lagi berarti ∞.
                    // Sumber kebenaran kuota = status harian dari backend (field `quota`).
                    const quota = u.quota;
                    // Sumber kebenaran: object `quota` (harian WIB). Legacy max_prompts
                    // hanya fallback tampilan untuk user lama.
                    const isUnlimited = Boolean(u.unlimited) || quota?.mode === "unlimited";
                    const dailyLimit = quota?.daily_limit ?? null;
                    const dailyUsed = quota?.used_today ?? null;
                    const dailyRemaining = quota?.remaining ?? null;
                    const quotaExpired = quota?.mode === "expired";
                    const hasDaily = !isUnlimited && !quotaExpired && dailyLimit != null;
                    const planSource = quota?.plan_source ?? null;
                    const planLabel = quota?.plan_label ?? (u.manual_plan_label || null);
                    const planDaysLeft = quota?.plan_days_left ?? null;
                    const subscription = isUnlimited
                      ? { text: "Tanpa batas" }
                      : planSource === "manual"
                        ? {
                            text: quotaExpired
                              ? "Manual habis"
                              : `Manual: ${planLabel || "kuota manual"}`,
                          }
                        : planSource === "plan"
                          ? {
                              text: quotaExpired
                                ? "Langganan habis"
                                : `Langganan: ${planLabel || "-"}`,
                            }
                          : planSource === "default"
                            ? { text: "Tidak berlangganan" }
                            : { text: "Tidak diketahui" };
                    // max_prompts legacy > 0 = batas kumulatif lama; 0 = tak dipakai lagi,
                    // jadi jangan tampilkan "kuota habis" atau ∞ palsu.
                    const hasLegacyLimit = Number(u.max_prompts) > 0;
                    const exhausted =
                      !isUnlimited &&
                      (quotaExpired || (hasDaily && Number(dailyUsed || 0) >= Number(dailyLimit)));
                    const remaining = hasDaily
                      ? Math.max(0, Number(dailyRemaining ?? 0))
                      : isUnlimited
                        ? Infinity
                        : hasLegacyLimit
                          ? Math.max(0, Number(u.max_prompts) - Number(u.prompts_used || 0))
                          : NaN;
                    const isGoogle = (u.provider || "").toLowerCase() === "google";
                    return (
                      <tr key={u.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-900 text-[12px] font-semibold uppercase text-zinc-400">
                              {(u.display_name || u.username || "?").slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <div className={`text-[15px] font-medium ${cUser}`}>{u.username}</div>
                              <div className="truncate text-[13px] text-zinc-500">
                                {u.display_name || "-"}
                                {u.email ? ` · ${u.email}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            {isGoogle ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium text-zinc-200">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                  <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                  />
                                  <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                  />
                                  <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                  />
                                  <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                  />
                                </svg>
                                Google
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium text-zinc-200">
                                {(u.provider || "").toLowerCase() === "manual"
                                  ? "Dibuat admin"
                                  : "Email & sandi"}
                              </span>
                            )}
                            {u.email ? (
                              isGoogle || u.email_verified ? (
                                <span className="text-[11px] font-medium text-emerald-400">
                                  Email terverifikasi
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-amber-400">
                                  Email belum diverifikasi
                                </span>
                              )
                            ) : (
                              <span className="text-[11px] text-zinc-500">Tanpa email</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {!u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11.5px] font-medium text-zinc-400">
                              <X className="h-3 w-3 text-red-500/80" strokeWidth={2.5} /> Nonaktif
                            </span>
                          ) : exhausted ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11.5px] font-medium text-zinc-400">
                              <AlertCircle
                                className="h-3 w-3 text-amber-500/80"
                                strokeWidth={2.5}
                              />{" "}
                              Kuota habis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11.5px] font-medium text-zinc-400">
                              <Check className="h-3 w-3 text-emerald-500/80" strokeWidth={2.5} />{" "}
                              Aktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11.5px] font-medium text-zinc-400">
                              {subscription.text}
                            </span>
                            {!isUnlimited && planSource !== "default" && planDaysLeft != null && (
                              <span className="text-[12px] text-zinc-500">
                                {planDaysLeft} hari lagi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-[14px] font-medium tabular-nums text-zinc-200">
                            {isUnlimited
                              ? "∞ tanpa batas"
                              : quotaExpired
                                ? "sisa 0 / paket habis"
                                : hasDaily
                                  ? `sisa ${remaining} / ${dailyLimit}`
                                  : hasLegacyLimit
                                    ? `sisa ${Math.max(
                                        0,
                                        Number(u.max_prompts) - Number(u.prompts_used || 0),
                                      )} / ${u.max_prompts}`
                                    : "tidak diketahui"}
                            {hasDaily && (
                              <span className="ml-1.5 text-zinc-500">
                                (terpakai {dailyUsed || 0})
                              </span>
                            )}
                          </div>
                          {hasDaily && (
                            <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-white/40"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      (Number(remaining) / Math.max(1, Number(dailyLimit))) * 100,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                          <div className="mt-1 text-[12px] text-zinc-500">
                            {isUnlimited
                              ? "tanpa batas harian"
                              : u.plan_label
                                ? `paket: ${u.plan_label} · reset 00:00 WIB`
                                : "paket tidak dikenal"}
                          </div>
                          {hasLegacyLimit && !hasDaily && (
                            <div className="mt-1 text-[12px] text-zinc-600">
                              legacy kumulatif: {u.prompts_used || 0} / {u.max_prompts}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] tabular-nums text-zinc-400">
                          {fmtDateTime(u.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] tabular-nums text-zinc-500">
                          {fmtDateTime(u.updated_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetUsage(u.id)}
                              className="h-8 border-white/10 text-[13px]"
                              title="Reset usage prompt"
                            >
                              Reset
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingUserId(u.id);
                                setUserForm({
                                  username: u.username,
                                  password: "",
                                  display_name: u.display_name || "",
                                  is_active: Boolean(u.is_active),
                                  unlimited: Boolean(u.unlimited),
                                });
                                setGrantForm({
                                  plan_id: "",
                                  prompts: u.manual_daily_limit ? String(u.manual_daily_limit) : "",
                                  days: "0",
                                  label: u.manual_plan_label || "",
                                });
                                setUserModalOpen(true);
                              }}
                              className="h-8 border-white/10 text-[13px]"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u.id)}
                              className="h-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                              title="Hapus user"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setUserModalOpen(false)}
        >
          <Card
            className="w-full max-w-md border-white/10 bg-zinc-900 rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className={cardHeaderCls}>
              <CardTitle className="text-[14px] font-semibold text-white">
                {editingUserId ? "Edit user" : "Tambah user"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <form onSubmit={handleCreateOrUpdateUser} className="space-y-4">
                {!editingUserId && (
                  <div className="space-y-2">
                    <Label className={tLabelPlain}>Username</Label>
                    <Input
                      value={userForm.username}
                      onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
                      required
                      minLength={3}
                      maxLength={32}
                      placeholder="johndoe"
                      className={inputCls}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className={tLabelPlain}>
                    {editingUserId ? "Password baru (kosongkan jika tidak ganti)" : "Password"}
                  </Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
                    required={!editingUserId}
                    minLength={8}
                    className={inputCls}
                  />
                  <p className="text-[12px] text-zinc-500">Minimal 8 karakter.</p>
                </div>
                <div className="space-y-2">
                  <Label className={tLabelPlain}>Display name</Label>
                  <Input
                    value={userForm.display_name}
                    onChange={(e) => setUserForm((p) => ({ ...p, display_name: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={tLabelPlain}>Unlimited</Label>
                  <Button
                    type="button"
                    variant={userForm.unlimited ? "default" : "outline"}
                    onClick={() => setUserForm((p) => ({ ...p, unlimited: !p.unlimited }))}
                    className={
                      userForm.unlimited
                        ? "h-9 w-full bg-emerald-500/90 text-[13px] font-semibold text-black hover:bg-emerald-400"
                        : "h-9 w-full border-white/10 text-[13px]"
                    }
                    title="Tanpa batas prompt harian untuk user ini"
                  >
                    {userForm.unlimited
                      ? "Unlimited aktif ∞ (klik untuk matikan)"
                      : "Set Unlimited (tanpa batas)"}
                  </Button>
                  <p className="text-[12px] text-zinc-500">
                    Satu-satunya cara memberi akses tanpa batas. User lain memakai kuota harian
                    (paket paid atau default di tab Pricing).
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[16px] text-zinc-300">
                  <input
                    type="checkbox"
                    checked={userForm.is_active}
                    onChange={(e) => setUserForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="rounded"
                  />{" "}
                  Aktif
                </label>
                {editingUserId && (
                  <div className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <Stamp className="h-4 w-4 text-sky-400/80" />
                      <span className="text-[14px] font-medium text-zinc-200">Kuota manual</span>
                    </div>
                    <p className="text-[12px] text-zinc-500">
                      Status saat ini:{" "}
                      {editingUser?.unlimited
                        ? "Unlimited"
                        : editingUser?.plan_source === "manual"
                          ? `manual — ${editingUser?.manual_plan_label || "kuota manual"}`
                          : editingUser?.plan_source === "plan"
                            ? `langganan — ${editingUser?.plan_label || "-"}`
                            : "tidak berlangganan"}
                      {editingUser?.manual_daily_limit
                        ? ` · ${editingUser.manual_daily_limit} prompt/hari`
                        : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className={tLabelPlain}>Kuota harian</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100000}
                          value={grantForm.prompts}
                          onChange={(e) => setGrantForm((p) => ({ ...p, prompts: e.target.value }))}
                          placeholder="mis. 500"
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={tLabelPlain}>Masa aktif (hari)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={3650}
                          value={grantForm.days}
                          onChange={(e) => setGrantForm((p) => ({ ...p, days: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className={tLabelPlain}>Paket acuan (opsional)</Label>
                      <select
                        value={grantForm.plan_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          const p = plans.find((pl) => String(pl.id) === id);
                          setGrantForm((prev) => ({
                            ...prev,
                            plan_id: id,
                            prompts: prev.prompts || (p ? String(p.prompts) : prev.prompts),
                            days: prev.days && prev.days !== "0" ? prev.days : String(p?.days || 0),
                          }));
                        }}
                        className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-[14px] text-zinc-200"
                      >
                        <option value="">Tanpa paket (angka manual saja)</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} · {p.prompts} prompt/hari
                          </option>
                        ))}
                      </select>
                      <p className="text-[12px] text-zinc-500">
                        0 hari = tanpa batas waktu. Grant manual menang atas paket paid & kuota
                        default, tapi kalah dari Unlimited.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savingUser || !editingUser?.manual_daily_limit}
                        onClick={() => editingUserId && handleClearQuota(editingUserId)}
                        className="h-9 border-white/10 text-[14px]"
                      >
                        Hapus kuota manual
                      </Button>
                      <Button
                        type="button"
                        disabled={savingUser || !grantForm.prompts}
                        onClick={submitGrant}
                        className="h-9 bg-sky-500/90 text-[14px] font-medium text-black hover:bg-sky-400 disabled:opacity-50"
                      >
                        {editingUser?.manual_daily_limit ? "Update kuota" : "Beri kuota"}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setUserModalOpen(false)}
                    className="h-9 text-[16px]"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingUser}
                    className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] disabled:opacity-50"
                  >
                    {savingUser ? "Menyimpan…" : "Simpan"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
