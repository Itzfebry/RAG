/**
 * Hook data admin - user & app settings.
 *
 * Diekstrak dari AdminPanel.tsx (Phase A); logika & bentuk payload tidak diubah.
 *
 * Deps:
 * - `authExpired`  : guard redirect login saat 401 (didefinisikan di AdminPanel, dipakai semua hook).
 * - `pushToast`    : notifikasi UI AdminPanel.
 *
 * Mengembalikan: state (users/loading/modal/form/appSettings), setter-nya, plus
 * aksi loadUsersAndSettings / sync / create-update / delete / reset-usage / save settings.
 */

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ApiError, fetchApi } from "@/lib/fetch-api";
import type { AdminPushToast, AdminUser, AppSettingsRaw } from "@/lib/api-types";

/** Bentuk appSettings setelah diparse dari backend. */
export type AppSettings = {
  user_token_expiry_hours: number;
  trial_prompts: number;
  rag_match_count_short: number;
  rag_match_count_long: number;
  rag_match_threshold: number | null;
};

export type AdminUsersDeps = {
  authExpired: (status: number) => boolean;
  pushToast: AdminPushToast;
};

function parseAppSettings(s: AppSettingsRaw): AppSettings {
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

export function useAdminUsers({ authExpired, pushToast }: AdminUsersDeps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    user_token_expiry_hours: 24,
    trial_prompts: 3,
    rag_match_count_short: 6,
    rag_match_count_long: 8,
    rag_match_threshold: null,
  });
  const [userModalOpen, setUserModalOpen] = useState(false);
  // Double-submit guard: matikan tombol submit sampai request selesai.
  const [savingUser, setSavingUser] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    display_name: "",
    is_active: true,
    unlimited: false,
  });
  // Form grant kuota manual (dipakai modal edit; tidak perlu effect prefill).
  const [grantForm, setGrantForm] = useState({
    plan_id: "",
    prompts: "",
    days: "0",
    label: "",
  });

  const loadUsersAndSettings = async () => {
    setUsersLoading(true);
    try {
      const results = await Promise.all([
        fetchApi<AdminUser[]>("/api/python/admin/users").catch(() => null),
        fetchApi<{ settings?: AppSettingsRaw }>("/api/python/admin/settings").catch(() => null),
      ]);
      const [u, s] = results;
      if (u) setUsers(u);
      if (s) setAppSettings(parseAppSettings((s.settings || s) as AppSettingsRaw));
    } catch {}
    setUsersLoading(false);
  };

  const handleSyncLocalUsers = async () => {
    setSyncingUsers(true);
    try {
      const j = await fetchApi<{ created?: number }>("/api/python/admin/users/sync-local", {
        method: "POST",
      });
      const n = Number(j.created || 0);
      pushToast(
        n > 0 ? "success" : "info",
        n > 0 ? `${n} user disinkronkan` : "Tidak ada user baru",
        n > 0
          ? "User lokal yang belum ada di database sudah dibuat."
          : "Semua user lokal sudah ada di database.",
      );
      loadUsersAndSettings();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as { detail?: unknown };
        pushToast(
          "error",
          "Gagal sinkron",
          typeof d.detail === "string" ? d.detail : `HTTP ${e.status}`,
        );
      } else {
        pushToast("error", "Gagal sinkron", "Tidak bisa menghubungi backend");
      }
    } finally {
      setSyncingUsers(false);
    }
  };

  const handleCreateOrUpdateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (savingUser) return;
    setSavingUser(true);
    const isEdit = Boolean(editingUserId);
    const url = isEdit ? `/api/python/admin/users/${editingUserId}` : "/api/python/admin/users";
    const method = isEdit ? "PUT" : "POST";
    const body = isEdit
      ? {
          display_name: userForm.display_name || null,
          is_active: userForm.is_active,
          unlimited: userForm.unlimited,
          ...(userForm.password ? { password: userForm.password } : {}),
        }
      : {
          username: userForm.username.trim().toLowerCase(),
          password: userForm.password,
          display_name: userForm.display_name || null,
          is_active: userForm.is_active,
          unlimited: userForm.unlimited,
        };
    try {
      await fetchApi(url, { method, json: body });
      pushToast("success", isEdit ? "User diperbarui" : "User dibuat");
      setUserModalOpen(false);
      setEditingUserId(null);
      setUserForm({
        username: "",
        password: "",
        display_name: "",
        is_active: true,
        unlimited: false,
      });
      setGrantForm({ plan_id: "", prompts: "", days: "0", label: "" });
      loadUsersAndSettings();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      const d = ((e instanceof ApiError ? e.data : null) ?? {}) as { detail?: unknown };
      pushToast(
        "error",
        "Gagal simpan user",
        typeof d.detail === "string" ? d.detail : JSON.stringify(d).slice(0, 140),
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Hapus user ini?")) return;
    try {
      await fetchApi(`/api/python/admin/users/${id}`, { method: "DELETE" });
      pushToast("success", "User dihapus");
      loadUsersAndSettings();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      pushToast("error", "Gagal hapus user");
    }
  };

  const handleResetUsage = async (id: string) => {
    try {
      await fetchApi(`/api/python/admin/users/${id}/reset-usage`, { method: "POST" });
      pushToast("success", "Usage direset");
      loadUsersAndSettings();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      pushToast("error", "Gagal reset");
    }
  };

  const handleGrantQuota = async (
    id: string,
    body: { prompts: number; plan_id?: string | null; days?: number; label?: string | null },
  ) => {
    if (savingUser) return;
    setSavingUser(true);
    try {
      await fetchApi(`/api/python/admin/users/${id}/quota`, { method: "POST", json: body });
      pushToast(
        "success",
        "Kuota manual disimpan",
        `${body.prompts} prompt/hari${body.days ? ` selama ${body.days} hari` : " tanpa batas waktu"}`,
      );
      loadUsersAndSettings();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as { detail?: unknown };
        pushToast(
          "error",
          "Gagal simpan kuota",
          typeof d.detail === "string" ? d.detail : `HTTP ${e.status}`,
        );
      } else {
        pushToast("error", "Gagal simpan kuota", "Tidak bisa menghubungi backend");
      }
    } finally {
      setSavingUser(false);
    }
  };

  const handleClearQuota = async (id: string) => {
    if (!confirm("Hapus kuota manual user ini? User kembali ke paket paid / kuota default."))
      return;
    if (savingUser) return;
    setSavingUser(true);
    try {
      await fetchApi(`/api/python/admin/users/${id}/quota`, { method: "DELETE" });
      pushToast("success", "Kuota manual dihapus");
      loadUsersAndSettings();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      pushToast("error", "Gagal hapus kuota");
    } finally {
      setSavingUser(false);
    }
  };

  const handleSaveSettings = async () => {
    if (savingSettings) return;
    setSavingSettings(true);
    const body: Record<string, number | null> = {
      user_token_expiry_hours: Number(appSettings.user_token_expiry_hours),
      trial_prompts: Number(appSettings.trial_prompts),
      rag_match_count_short: Number(appSettings.rag_match_count_short),
      rag_match_count_long: Number(appSettings.rag_match_count_long),
    };
    const payloadBody = {
      ...body,
      rag_match_threshold:
        appSettings.rag_match_threshold === null ? null : Number(appSettings.rag_match_threshold),
    };
    try {
      const j = await fetchApi<{ settings?: AppSettingsRaw }>("/api/python/admin/settings", {
        method: "PUT",
        json: payloadBody,
      });
      const s = j.settings || j;
      setAppSettings(parseAppSettings(s as AppSettingsRaw));
      pushToast("success", "Pengaturan disimpan");
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as { detail?: unknown };
        const msg = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail || d);
        pushToast("error", "Gagal simpan", msg.slice(0, 120));
      }
    } finally {
      setSavingSettings(false);
    }
  };

  return {
    users,
    setUsers,
    usersLoading,
    setUsersLoading,
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
    grantForm,
    setGrantForm,
    loadUsersAndSettings,
    handleSyncLocalUsers,
    handleCreateOrUpdateUser,
    handleDeleteUser,
    handleResetUsage,
    handleGrantQuota,
    handleClearQuota,
    handleSaveSettings,
  };
}

export type AdminUsersApi = ReturnType<typeof useAdminUsers>;
export type AppSettingsSetter = Dispatch<SetStateAction<AppSettings>>;
