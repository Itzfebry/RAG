"use client";

/**
 * Tab Users AdminPanel.
 *
 * Diekstrak dari AdminPanel.tsx (Phase B); markup & logika dipindah apa adanya.
 * Menerima data/aksi via props eksplisit (bukan objek hook) dari AdminPanel.
 */

import React, { type Dispatch, type FormEvent, type SetStateAction } from "react";
import { AlertCircle, Check, Loader2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
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
import type { AdminUser } from "@/lib/api-types";
import type { AppSettings, AppSettingsSetter } from "../hooks/use-admin-users";

export type UserFormState = {
  username: string;
  password: string;
  display_name: string;
  max_prompts: number;
  is_active: boolean;
};

export type UsersTabProps = {
  users: AdminUser[];
  usersLoading: boolean;
  syncingUsers: boolean;
  appSettings: AppSettings;
  setAppSettings: AppSettingsSetter;
  onSaveSettings: () => Promise<void>;
  onSyncLocalUsers: () => Promise<void>;
  userModalOpen: boolean;
  setUserModalOpen: Dispatch<SetStateAction<boolean>>;
  editingUserId: string | null;
  setEditingUserId: Dispatch<SetStateAction<string | null>>;
  userForm: UserFormState;
  setUserForm: Dispatch<SetStateAction<UserFormState>>;
  onSubmitUser: (e: FormEvent) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onResetUsage: (id: string) => Promise<void>;
};

export function UsersTab({
  users,
  usersLoading,
  syncingUsers,
  appSettings,
  setAppSettings,
  onSaveSettings: handleSaveSettings,
  onSyncLocalUsers: handleSyncLocalUsers,
  userModalOpen,
  setUserModalOpen,
  editingUserId,
  setEditingUserId,
  userForm,
  setUserForm,
  onSubmitUser: handleCreateOrUpdateUser,
  onDeleteUser: handleDeleteUser,
  onResetUsage: handleResetUsage,
}: UsersTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
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
            className="h-9 bg-white text-black hover:bg-zinc-100 gap-1.5 text-[16px] font-medium"
          >
            <Save className="h-4 w-4" /> Simpan
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
                max_prompts: 50,
                is_active: true,
              });
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
                      Kuota prompt
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
                    const isUnlimited = Number(u.max_prompts) === 0;
                    const exhausted =
                      !isUnlimited && Number(u.prompts_used || 0) >= Number(u.max_prompts);
                    const remaining = isUnlimited
                      ? Infinity
                      : Math.max(0, Number(u.max_prompts) - Number(u.prompts_used || 0));
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
                          <div className="text-[14px] font-medium tabular-nums text-zinc-200">
                            {u.prompts_used || 0} / {isUnlimited ? "∞" : u.max_prompts}
                            {!isUnlimited && (
                              <span className="ml-1.5 text-zinc-500">(sisa {remaining})</span>
                            )}
                          </div>
                          {!isUnlimited && (
                            <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className={`h-full rounded-full ${exhausted ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{
                                  width: `${Math.min(100, Math.round((Number(u.prompts_used || 0) / Number(u.max_prompts)) * 100))}%`,
                                }}
                              />
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
                                  max_prompts: Number(u.max_prompts),
                                  is_active: Boolean(u.is_active),
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
                    minLength={6}
                    className={inputCls}
                  />
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
                  <Label className={tLabelPlain}>Batas prompt (0 = unlimited)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    value={userForm.max_prompts}
                    onChange={(e) =>
                      setUserForm((p) => ({ ...p, max_prompts: Number(e.target.value) }))
                    }
                    className={inputCls}
                  />
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
                    className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px]"
                  >
                    Simpan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
