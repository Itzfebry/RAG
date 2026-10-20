/**
 * Hook data admin - knowledge base (kategori, entry, reindex, aksi entry).
 *
 * Diekstrak dari AdminPanel.tsx (Phase A); logika & bentuk payload tidak diubah.
 *
 * Deps:
 * - `authExpired`   : guard redirect login saat 401 (dari AdminPanel).
 * - `pushToast`     : notifikasi UI AdminPanel.
 * - `getBootstrap`  : akses lazy ke hasil useAdminBootstrap (hook bootstrap
 *   dibuat SETELAH hook ini di AdminPanel) untuk reload data & audit.
 *
 * `ingestBootstrap` berisi blok knowledge dari loadAllData lama, dipanggil
 * bootstrap hook saat payload bootstrap datang. categoryData juga dimiliki hook
 * ini karena diisi oleh ingestBootstrap maupun fetchStats (via setCategoryData
 * yang diteruskan ke useAdminTokens).
 */

import { useState, type FormEvent } from "react";
import { ApiError, fetchApi } from "@/lib/fetch-api";
import type {
  AdminBootstrap,
  AdminPushToast,
  KnowledgeCategory,
  KnowledgeEntry,
} from "@/lib/api-types";
import type { CategoryDatum, CategoryDataSetter } from "./use-admin-tokens";

export type AdminKnowledgeDeps = {
  authExpired: (status: number) => boolean;
  pushToast: AdminPushToast;
  getBootstrap: () => { loadAllData?: () => Promise<void>; loadAudit?: () => Promise<void> } | null;
};

export function useAdminKnowledge({ authExpired, pushToast, getBootstrap }: AdminKnowledgeDeps) {
  // Adapter lazy: aksi di hook ini butuh reload-all / audit milik bootstrap hook
  // yang dibuat belakangan (dipecahkan lewat getter, tanpa restrukturisasi logic).
  const loadAllData = () => void getBootstrap()?.loadAllData?.();
  const loadAudit = () => void getBootstrap()?.loadAudit?.();

  const [reindexing, setReindexing] = useState(false);
  const [categoryData, setCategoryData] = useState<CategoryDatum[]>([]);

  const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeCategory[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("technical_knowledge");
  const [newEntryModal, setNewEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ id: "", title: "", content: "", category_id: "" });

  /* Blok knowledge dari loadAllData lama (pindah utuh). */
  const ingestBootstrap = (b: AdminBootstrap) => {
    const cats = Array.isArray(b.categories) ? b.categories : [];
    const entries = Array.isArray(b.entries) ? b.entries : [];
    setKnowledgeCategories(cats);
    setKnowledgeEntries(entries);
    const catCounts: Record<string, number> = {};
    entries.forEach((e) => {
      const cat = cats.find((x) => x.id === e.category_id);
      if (cat) catCounts[cat.name] = (catCounts[cat.name] || 0) + 1;
    });
    setCategoryData(Object.entries(catCounts).map(([name, value]) => ({ name, value })));
  };

  const runReindex = async () => {
    if (
      !window.confirm(
        "Embed ulang SEMUA knowledge entry ke provider aktif? Bisa memakan waktu dan kuota API.",
      )
    )
      return;
    setReindexing(true);
    try {
      const j = await fetchApi<{ entries?: number; chunks?: number; provider?: string }>(
        "/api/python/admin/knowledge/reindex",
        { method: "POST" },
      );
      pushToast(
        "success",
        "Reindex selesai",
        `${j.entries} entry, ${j.chunks} chunk (${j.provider})`,
      );
      loadAudit();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && authExpired(e.status)) return;
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as { detail?: unknown };
        pushToast(
          "error",
          "Reindex gagal",
          typeof d.detail === "string" ? d.detail : `HTTP ${e.status}`,
        );
      } else {
        pushToast("error", "Reindex gagal", "Tidak bisa menghubungi backend");
      }
    } finally {
      setReindexing(false);
    }
  };

  const handleSaveKnowledgeEntry = async (e: FormEvent) => {
    e.preventDefault();
    const cat = knowledgeCategories.find((c) => c.slug === selectedCategorySlug);
    if (!cat) return;
    try {
      await fetchApi("/api/python/admin/knowledge/entries", {
        method: "POST",
        json: {
          id: entryForm.id || undefined,
          category_id: cat.id,
          title: entryForm.title,
          content: entryForm.content,
          is_active: true,
        },
      });
      setNewEntryModal(false);
      setEntryForm({ id: "", title: "", content: "", category_id: "" });
      loadAllData();
      pushToast("success", "Knowledge ditambah", entryForm.title.slice(0, 60));
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        if (authExpired(e.status)) return;
        const d = (e.data ?? {}) as { detail?: unknown };
        const msg = d.detail || "Gagal simpan knowledge";
        pushToast(
          "error",
          "Gagal simpan",
          typeof msg === "string" ? (msg as string).slice(0, 120) : "Cek input.",
        );
      } else {
        const err = e as { message?: string };
        pushToast("error", "Gagal simpan", err.message?.slice(0, 120) || "Error");
      }
    }
  };

  const handleDeleteKnowledgeEntry = async (id: string) => {
    if (!confirm("Hapus entri knowledge ini?")) return;
    try {
      await fetchApi(`/api/python/admin/knowledge/entries/${id}`, { method: "DELETE" });
      loadAllData();
      pushToast("success", "Terhapus", "Entri knowledge dihapus.");
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as { detail?: unknown };
        pushToast(
          "error",
          "Gagal hapus",
          (typeof d.detail === "string" ? (d.detail as string).slice(0, 120) : "") || "Coba lagi.",
        );
      } else {
        const err = e as { message?: string };
        pushToast("error", "Gagal hapus", err.message?.slice(0, 120) || "Error");
      }
    }
  };

  return {
    knowledgeCategories,
    knowledgeEntries,
    selectedCategorySlug,
    setSelectedCategorySlug,
    newEntryModal,
    setNewEntryModal,
    entryForm,
    setEntryForm,
    categoryData,
    setCategoryData,
    reindexing,
    ingestBootstrap,
    runReindex,
    handleSaveKnowledgeEntry,
    handleDeleteKnowledgeEntry,
  };
}

export type AdminKnowledgeApi = ReturnType<typeof useAdminKnowledge>;
