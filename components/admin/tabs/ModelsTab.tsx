"use client";

/**
 * Tab Models (AI Models) AdminPanel.
 *
 * Diekstrak dari AdminPanel.tsx (Phase B); markup & logika dipindah apa adanya.
 * Menerima data/aksi via props eksplisit (bukan objek hook) dari AdminPanel.
 */

import React, { type Dispatch, type SetStateAction } from "react";
import {
  Box,
  Brain,
  Cpu,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { SectionHeader } from "../SectionHeader";
import { FieldInfo } from "../FieldInfo";
import {
  cardBase,
  cardHeaderCls,
  cardContentCls,
  tCardPlain,
  tLabelPlain,
  cModel,
  inputCls,
} from "../adminStyles";
import type { ModelCatalogEntry } from "@/lib/api-types";
import type { AdminBootstrapApi } from "../hooks/use-admin-bootstrap";

type ModelConfig = AdminBootstrapApi["modelConfig"];
type ModelTestResults = AdminBootstrapApi["modelTestResults"];

export type ModelsTabProps = {
  modelConfig: ModelConfig;
  setModelConfig: Dispatch<SetStateAction<ModelConfig>>;
  modelTestResults: ModelTestResults;
  onTestModel: (modelId: string) => Promise<void>;
  onSaveModelConfig: () => Promise<void>;
  saving: boolean;
  availableModels: ModelCatalogEntry[];
  modelsLoading: boolean;
  modelSearch: string;
  setModelSearch: Dispatch<SetStateAction<string>>;
  freeOnly: boolean;
  setFreeOnly: Dispatch<SetStateAction<boolean>>;
  fallbackInput: string;
  setFallbackInput: Dispatch<SetStateAction<string>>;
  catalogApiKey: string;
  setCatalogApiKey: Dispatch<SetStateAction<string>>;
  catalogBaseUrl: string;
  setCatalogBaseUrl: Dispatch<SetStateAction<string>>;
  showCatalogKey: boolean;
  setShowCatalogKey: Dispatch<SetStateAction<boolean>>;
  refreshAvailableModels: (opts?: { freeOnly?: boolean }) => Promise<void>;
};

export function ModelsTab({
  modelConfig,
  setModelConfig,
  modelTestResults,
  onTestModel: handleTestModel,
  onSaveModelConfig: handleSaveModelConfig,
  saving,
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
  refreshAvailableModels,
}: ModelsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <SectionHeader
        title="Model AI"
        desc="Model yang sedang dipakai ditampilkan pertama. Pilih dari katalog live atau ketik ID model apa pun."
      />

      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={`${tCardPlain} flex items-center gap-2`}>
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            Model yang sedang dipakai
          </CardTitle>
        </CardHeader>
        <CardContent className={`${cardContentCls} space-y-2`}>
          <p className={`break-all text-[16px] font-medium leading-relaxed ${cModel}`}>
            {modelConfig.active_model || "- belum dimuat -"}
          </p>
          <p className="text-[16px] leading-relaxed text-zinc-500">
            provider: <span className="text-zinc-300">{modelConfig.provider}</span> · base:{" "}
            <span className="break-all text-zinc-300">{modelConfig.api_base_url}</span>
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-500">
            Fallback:{" "}
            {modelConfig.fallback_models.length
              ? modelConfig.fallback_models.join(", ")
              : "- tidak ada -"}{" "}
            · temp: {modelConfig.temperature} · reasoning:{" "}
            {modelConfig.reasoning_enabled ? "aktif" : "nonaktif"}
          </p>
        </CardContent>
      </Card>

      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={tCardPlain}>Konfigurasi Model</CardTitle>
          <CardDescription className="text-[16px] leading-relaxed text-zinc-500">
            Atur model aktif, provider, dan fallback chain
          </CardDescription>
        </CardHeader>
        <CardContent className={`${cardContentCls} grid gap-4`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className={tLabelPlain}>
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-zinc-500" />
                  ID model aktif
                  <FieldInfo text="Model utama yang dipakai menjawab chat. Pilih dari katalog live atau ketik ID model apa pun, format provider/nama-model." />
                </span>
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestModel(modelConfig.active_model)}
                disabled={
                  !modelConfig.active_model.trim() ||
                  modelTestResults[modelConfig.active_model]?.status === "loading"
                }
                className="h-7 border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-zinc-300 gap-1"
              >
                {modelTestResults[modelConfig.active_model]?.status === "loading" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}{" "}
                Test
              </Button>
            </div>
            {modelTestResults[modelConfig.active_model] &&
              modelTestResults[modelConfig.active_model].status !== "loading" && (
                <div
                  className={`rounded-lg border px-3 py-2 text-[13px] ${modelTestResults[modelConfig.active_model].status === "ok" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}
                >
                  {modelTestResults[modelConfig.active_model].status === "ok"
                    ? `OK · ${modelTestResults[modelConfig.active_model].latency_ms}ms`
                    : `Gagal · ${modelTestResults[modelConfig.active_model].error?.slice(0, 120)}`}
                  {modelTestResults[modelConfig.active_model].sample
                    ? ` · "${modelTestResults[modelConfig.active_model].sample}"`
                    : ""}
                </div>
              )}
            <Input
              list="admin-model-options"
              value={modelConfig.active_model}
              onChange={(e) => setModelConfig({ ...modelConfig, active_model: e.target.value })}
              placeholder="cth. qwen/qwen3.8-27b:free"
              className={inputCls}
            />
            <datalist id="admin-model-options">
              {availableModels
                .filter((m) => {
                  if (!modelSearch) return true;
                  const q = modelSearch.toLowerCase();
                  return (
                    (m.id || "").toLowerCase().includes(q) ||
                    (m.name || "").toLowerCase().includes(q)
                  );
                })
                .slice(0, 60)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className={tLabelPlain}>
                <span className="flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5 text-zinc-500" />
                  Provider
                  <FieldInfo text="Nama provider pada gateway OpenAI-compatible yang dipakai, mis. openrouter. Harus cocok dengan API base URL." />
                </span>
              </Label>
              <Input
                value={modelConfig.provider}
                onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })}
                placeholder="openrouter"
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label className={tLabelPlain}>
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-zinc-500" />
                  API base URL
                  <FieldInfo text="Endpoint API OpenAI-compatible tempat request model dikirim, mis. https://openrouter.ai/api/v1" />
                </span>
              </Label>
              <Input
                value={modelConfig.api_base_url}
                onChange={(e) => setModelConfig({ ...modelConfig, api_base_url: e.target.value })}
                placeholder="https://openrouter.ai/api/v1"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className={tLabelPlain}>
                <span className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-zinc-500" />
                  Temperature (0–2)
                  <FieldInfo text="Kreativitas jawaban. Rendah (0–0.3) = jawaban konsisten dan faktual, cocok untuk RAG. Tinggi (1–2) = lebih bervariasi tapi rawan ngawur." />
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={modelConfig.temperature}
                onChange={(e) =>
                  setModelConfig({
                    ...modelConfig,
                    temperature: Number(e.target.value) || 0,
                  })
                }
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label className={tLabelPlain}>
                <span className="flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5 text-zinc-500" />
                  Max tokens
                  <FieldInfo text="Budget total token output. Model reasoning pakai sebagian ini untuk berpikir, sisa baru jadi jawaban." />
                </span>
              </Label>
              <Input
                type="number"
                min={256}
                max={131072}
                step={256}
                value={modelConfig.max_tokens}
                onChange={(e) =>
                  setModelConfig({
                    ...modelConfig,
                    max_tokens: Number(e.target.value) || 8192,
                  })
                }
                className={inputCls}
              />
            </div>
            <Label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[16px] font-normal text-zinc-300">
              <Checkbox
                checked={modelConfig.reasoning_enabled}
                onCheckedChange={(checked) =>
                  setModelConfig({ ...modelConfig, reasoning_enabled: Boolean(checked) })
                }
              />
              <span className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-zinc-500" />
                Reasoning aktif
                <FieldInfo text="Mode chain-of-thought model: jawaban lebih teliti untuk soal rumit, tapi lebih lambat dan memakai sebagian Max tokens untuk berpikir." />
              </span>
            </Label>
          </div>

          <div className="space-y-2">
            <Label className={tLabelPlain}>
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-zinc-500" />
                Model fallback
                <FieldInfo text="Daftar model cadangan, dipakai berurutan kalau model aktif error/rate-limited. Kosong = tanpa cadangan, chat gagal langsung." />
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {modelConfig.fallback_models.map((mid) => (
                <Badge
                  key={mid}
                  variant="secondary"
                  className="gap-2 py-1.5 text-[14px] bg-white/10 text-zinc-300 border border-white/10"
                >
                  {mid}
                  <button
                    type="button"
                    onClick={() =>
                      setModelConfig({
                        ...modelConfig,
                        fallback_models: modelConfig.fallback_models.filter((x) => x !== mid),
                      })
                    }
                    className="ml-1 rounded-full bg-white/10 text-zinc-300 px-1.5 py-0.5 text-[13px] hover:bg-red-500/20 hover:text-red-300 border border-white/10"
                    title="Hapus fallback"
                  >
                    ✕
                  </button>
                </Badge>
              ))}
              {modelConfig.fallback_models.length === 0 && (
                <span className="text-[16px] text-zinc-500">Belum ada fallback</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={fallbackInput}
                onChange={(e) => setFallbackInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = fallbackInput.trim();
                    if (v && !modelConfig.fallback_models.includes(v))
                      setModelConfig({
                        ...modelConfig,
                        fallback_models: [...modelConfig.fallback_models, v],
                      });
                    setFallbackInput("");
                  }
                }}
                placeholder="Ketik ID model lalu Enter"
                className={`${inputCls} flex-1`}
              />
              <Button
                type="button"
                onClick={() => {
                  const v = fallbackInput.trim();
                  if (v && !modelConfig.fallback_models.includes(v))
                    setModelConfig({
                      ...modelConfig,
                      fallback_models: [...modelConfig.fallback_models, v],
                    });
                  setFallbackInput("");
                }}
                className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] gap-1.5"
              >
                <Plus className="h-4 w-4" /> Tambah
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end p-5 pt-0">
          <Button
            onClick={handleSaveModelConfig}
            disabled={saving || !modelConfig.active_model.trim()}
            className="h-9 bg-white text-black hover:bg-zinc-100 text-[16px] font-medium gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi Model"}</span>
          </Button>
        </CardFooter>
      </Card>

      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className={tCardPlain}>Katalog model live</CardTitle>
                <CardDescription className="text-[16px] leading-relaxed text-zinc-500">
                  Sumber: katalog provider · API key & base URL katalog terpisah dari model aktif
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="flex cursor-pointer items-center gap-2 text-[14px] font-normal text-zinc-400">
                  <Checkbox
                    checked={freeOnly}
                    onCheckedChange={(checked) => {
                      setFreeOnly(Boolean(checked));
                      refreshAvailableModels({ freeOnly: Boolean(checked) });
                    }}
                  />
                  Hanya gratis
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshAvailableModels()}
                  disabled={modelsLoading}
                  className="h-8 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px]"
                >
                  {modelsLoading ? "Memuat..." : "Muat ulang"}
                </Button>
                <Input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Cari model..."
                  className="h-8 w-40 border-white/10 bg-white/[0.04] text-white text-[16px]"
                />
              </div>
            </div>
            <div className="grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3" /> API key katalog (preview saja, tidak disimpan)
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    type={showCatalogKey ? "text" : "password"}
                    value={catalogApiKey}
                    onChange={(e) => setCatalogApiKey(e.target.value)}
                    placeholder="sk-... (kosong = pakai env/server)"
                    className={`${inputCls} h-8`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCatalogKey((v) => !v)}
                    className="h-8 w-8 shrink-0 text-zinc-400"
                    type="button"
                  >
                    {showCatalogKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Base URL katalog
                </Label>
                <Input
                  value={catalogBaseUrl}
                  onChange={(e) => setCatalogBaseUrl(e.target.value)}
                  placeholder="https://api.groq.com/openai/v1 (kosong = default)"
                  className={`${inputCls} h-8`}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[28rem] overflow-y-auto rounded-b-xl border-t border-white/[0.07]">
            {availableModels.length === 0 ? (
              <div className="p-6 text-center text-[16px] text-zinc-500">
                {modelsLoading
                  ? "Memuat katalog..."
                  : "Tidak ada model. Cek API key atau tekan Muat ulang."}
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {availableModels
                  .filter((m) => {
                    if (!modelSearch) return true;
                    const q = modelSearch.toLowerCase();
                    return (
                      (m.id || "").toLowerCase().includes(q) ||
                      (m.name || "").toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 120)
                  .map((m) => {
                    const isActive = m.id === modelConfig.active_model;
                    return (
                      <li
                        key={m.id}
                        className={`flex items-start justify-between gap-3 px-5 py-4 ${isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`font-mono text-[14px] font-medium ${isActive ? "text-emerald-300" : cModel}`}
                            >
                              {m.id}
                            </span>
                            {isActive && (
                              <Badge className="bg-white text-black text-[10px]">AKTIF</Badge>
                            )}
                            {m.pricing &&
                              (m.pricing.prompt === "0" ||
                                String(m.pricing.prompt) === "0.0000000") && (
                                <Badge
                                  variant="outline"
                                  className="border-white/10 text-zinc-400 text-[10px]"
                                >
                                  GRATIS
                                </Badge>
                              )}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-zinc-500">
                            {m.name || m.description || ""}
                          </div>
                          {m.context_length ? (
                            <div className="text-[13px] text-zinc-500">
                              context: {Number(m.context_length).toLocaleString("id-ID")}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <Button
                            variant={isActive ? "secondary" : "default"}
                            size="sm"
                            onClick={() => setModelConfig({ ...modelConfig, active_model: m.id })}
                            className={`h-7 text-[14px] ${isActive ? "bg-zinc-800 text-zinc-200" : "bg-white text-black hover:bg-zinc-100"}`}
                          >
                            {isActive ? "Aktif" : "Pakai"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!modelConfig.fallback_models.includes(m.id))
                                setModelConfig({
                                  ...modelConfig,
                                  fallback_models: [...modelConfig.fallback_models, m.id],
                                });
                            }}
                            disabled={modelConfig.fallback_models.includes(m.id) || isActive}
                            className="h-7 border-white/10 bg-white/[0.04] text-zinc-300 text-[14px]"
                          >
                            + Fallback
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestModel(m.id)}
                            disabled={modelTestResults[m.id]?.status === "loading"}
                            className={`h-7 text-[13px] ${modelTestResults[m.id]?.status === "ok" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : modelTestResults[m.id]?.status === "error" ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}
                          >
                            {modelTestResults[m.id]?.status === "loading" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : modelTestResults[m.id]?.status === "ok" ? (
                              `OK ${modelTestResults[m.id]?.latency_ms}ms`
                            ) : modelTestResults[m.id]?.status === "error" ? (
                              "Gagal"
                            ) : (
                              "Test"
                            )}
                          </Button>
                          {modelTestResults[m.id]?.error && (
                            <span
                              className="max-w-[140px] truncate text-[13px] text-red-300/70"
                              title={modelTestResults[m.id]?.error}
                            >
                              {modelTestResults[m.id]?.error}
                            </span>
                          )}
                          {modelTestResults[m.id]?.sample && (
                            <span className="max-w-[140px] truncate text-[13px] text-emerald-300/70">
                              “{modelTestResults[m.id]?.sample}”
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
