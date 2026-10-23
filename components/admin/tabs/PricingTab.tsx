"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  QrCode,
  Receipt,
  Check,
  X,
  RefreshCw,
  Upload,
  ImageOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError, fetchApi } from "@/lib/fetch-api";
import type { PricingData, PricingPlan } from "@/lib/api-types";
import { SectionHeader } from "../SectionHeader";
import {
  cardBase,
  cardHeaderCls,
  cardContentCls,
  tCard,
  tLabel,
  cEmerald,
  cAmber,
  cRose,
  inputCls,
  textareaCls,
} from "../adminStyles";

export type PlanRow = PricingPlan;

const MAX_PLANS = 12;
const MAX_QRIS_CHARS = 600_000;

type OrderRow = {
  id: string;
  plan_label?: string;
  plan_id: string;
  prompts: number;
  days?: number | null;
  expires_in_days?: number | null;
  amount: number;
  status: string;
  username?: string;
  display_name?: string;
  created_at?: string;
  paid_at?: string | null;
};

const rupiah = (n: number) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export function PricingTab({
  pricing,
  onChange,
  onSave,
  saving,
  pushToast,
}: {
  pricing: PricingData;
  onChange: (next: PricingData) => void;
  onSave: () => void;
  saving: boolean;
  pushToast: (kind: "success" | "error" | "info", title: string, desc?: string) => void;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<{ pending: number; paid: number; cancelled: number }>({
    pending: 0,
    paid: 0,
    cancelled: 0,
  });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "cancelled">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrisError, setQrisError] = useState<string | null>(null);
  const qrisFileRef = useRef<HTMLInputElement | null>(null);

  const handleQrisFile = (file: File | null | undefined) => {
    setQrisError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setQrisError("File harus berupa gambar (PNG/JPG).");
      return;
    }
    if (file.size > 500_000) {
      setQrisError(
        `Gambar ${(file.size / 1000).toFixed(0)} KB terlalu besar. Maks 500 KB (QR biasanya < 50 KB).`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl.length > MAX_QRIS_CHARS) {
        setQrisError("Hasil gambar terlalu besar setelah encode. Pakai gambar lebih kecil.");
        return;
      }
      onChange({ ...pricing, payment_qris: dataUrl });
    };
    reader.onerror = () => setQrisError("Gagal membaca file gambar.");
    reader.readAsDataURL(file);
  };

  const validate = (): string | null => {
    const plans = pricing.plans;
    if (plans.length === 0) return "Tambahkan minimal satu paket sebelum menyimpan.";
    if (plans.length > MAX_PLANS) return `Maksimal ${MAX_PLANS} paket. Sekarang ${plans.length}.`;
    if ((pricing.payment_qris || "").length > MAX_QRIS_CHARS) {
      return `QRIS terlalu besar (${(pricing.payment_qris.length / 1000).toFixed(0)} ribu karakter). Upload gambar lebih kecil atau pakai URL gambar.`;
    }
    const seen = new Set<string>();
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      const pid = (p.id || "").trim();
      const label = (p.label || "").trim();
      if (!pid) return `Paket #${i + 1}: kolom ID masih kosong.`;
      if (!label) return `Paket #${i + 1}: kolom Label masih kosong.`;
      if (seen.has(pid)) return `Paket #${i + 1}: ID "${pid}" duplikat.`;
      if (!/^[A-Za-z0-9_-]+$/.test(pid))
        return `Paket #${i + 1}: ID hanya boleh huruf, angka, tanda hubung (-), dan garis bawah (_).`;
      if (!Number.isFinite(Number(p.prompts)) || Number(p.prompts) <= 0)
        return `Paket #${i + 1}: jumlah prompt harus lebih dari 0.`;
      const days = Number(p.days ?? 0);
      if (!Number.isInteger(days) || days < 0 || days > 3650)
        return `Paket #${i + 1}: masa aktif harus bilangan bulat 0-3650 hari (0 = tanpa batas waktu).`;
      if (!Number.isFinite(Number(p.amount)) || Number(p.amount) < 0)
        return `Paket #${i + 1}: harga tidak valid.`;
      const orig = p.original_amount;
      if (orig !== null && orig !== undefined && orig !== "") {
        if (!Number.isFinite(Number(orig)) || Number(orig) <= 0)
          return `Paket #${i + 1}: harga coret harus angka lebih dari 0 (atau dikosongkan).`;
        if (Number(orig) <= Number(p.amount))
          return `Paket #${i + 1}: harga coret harus lebih besar dari harga akhir (diskon baru terasa).`;
      }
      seen.add(pid);
    }
    return null;
  };

  const handleSave = () => {
    if (saving) return;
    const err = validate();
    if (err) {
      setFormError(err);
      pushToast("error", "Belum bisa disimpan", err);
      return;
    }
    setFormError(null);
    onSave();
  };

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const j = await fetchApi<{
        items?: OrderRow[];
        counts?: { pending: number; paid: number; cancelled: number };
      }>("/api/python/admin/orders");
      setOrders(Array.isArray(j.items) ? j.items : []);
      if (j.counts) setCounts(j.counts);
    } catch {}
    setLoadingOrders(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const act = async (id: string, action: "confirm" | "cancel") => {
    setBusyId(id);
    try {
      await fetchApi(`/api/python/admin/orders/${id}/${action}`, { method: "POST" });
      pushToast(
        "success",
        action === "confirm" ? "Order dikonfirmasi" : "Order dibatalkan",
        action === "confirm" ? "Kuota user sudah ditambahkan." : undefined,
      );
      await loadOrders();
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) {
        const d = (e.data ?? {}) as { detail?: unknown };
        pushToast(
          "error",
          action === "confirm" ? "Gagal konfirmasi" : "Gagal batalkan",
          typeof d.detail === "string" ? d.detail : `HTTP ${e.status}`,
        );
      } else {
        pushToast("error", "Gagal", "Tidak bisa menghubungi backend");
      }
    } finally {
      setBusyId(null);
    }
  };

  const updatePlan = (idx: number, patch: Partial<PlanRow>) =>
    onChange({
      ...pricing,
      plans: pricing.plans.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });

  const addPlan = () =>
    onChange({
      ...pricing,
      plans: [
        ...pricing.plans,
        {
          id: "",
          label: "",
          prompts: 100,
          days: 30,
          amount: 30000,
          popular: false,
          original_amount: null,
        },
      ],
    });

  const removePlan = (idx: number) =>
    onChange({ ...pricing, plans: pricing.plans.filter((_, i) => i !== idx) });

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 fill-mode-both">
      <SectionHeader
        title="Harga & Paket"
        desc="Atur paket prompt dan info pembayaran. Setiap paket punya masa aktif (hari) — 0 berarti tanpa batas waktu. Pembayaran masuk mengaktifkan kuota otomatis lewat notifikasi gateway - konfirmasi manual hanya jaga-jaga bila notifikasi gagal. Pantau lewat log pembayaran di bawah."
      />

      {/* Paket */}
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className={tCard}>Paket Prompt</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={addPlan}
              disabled={pricing.plans.length >= MAX_PLANS}
              className="h-8 border-white/10 bg-white/[0.04] text-[13px] gap-1.5 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah paket
            </Button>
          </div>
        </CardHeader>
        <CardContent className={`${cardContentCls} space-y-3`}>
          {pricing.plans.length === 0 && (
            <p className="text-[14px] text-zinc-500">Belum ada paket.</p>
          )}
          {pricing.plans.map((p, idx) => (
            <div key={idx} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className={tLabel}>ID</Label>
                  <Input
                    value={p.id}
                    onChange={(e) => updatePlan(idx, { id: e.target.value })}
                    placeholder="100"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className={tLabel}>Label</Label>
                  <Input
                    value={p.label}
                    onChange={(e) => updatePlan(idx, { label: e.target.value })}
                    placeholder="Paket 100 Prompt"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={tLabel}>Prompt / hari</Label>
                  <Input
                    type="number"
                    min={1}
                    value={p.prompts}
                    onChange={(e) => updatePlan(idx, { prompts: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={tLabel}>Masa aktif (hari)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={p.days ?? 0}
                    onChange={(e) =>
                      updatePlan(idx, {
                        days: e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)),
                      })
                    }
                    className={inputCls}
                  />
                  <p className="text-[11px] text-zinc-600">
                    {p.days && p.days > 0
                      ? `≈ ${Math.round((p.days / 30) * 10) / 10} bulan`
                      : "0 = tanpa batas waktu"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className={tLabel}>Harga (Rp)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={p.amount}
                    onChange={(e) => updatePlan(idx, { amount: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={tLabel}>Harga coret (opsional)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={p.original_amount ?? ""}
                    onChange={(e) =>
                      updatePlan(idx, {
                        original_amount: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="tanpa diskon"
                    className={inputCls}
                  />
                  {(() => {
                    const orig = Number(p.original_amount || 0);
                    const amt = Number(p.amount || 0);
                    if (orig > amt && amt > 0) {
                      return (
                        <p className="text-[11px] tabular-nums text-emerald-400">
                          hemat {Math.round((1 - amt / orig) * 100)}% ({rupiah(orig - amt)})
                        </p>
                      );
                    }
                    return (
                      <p className="text-[11px] text-zinc-600">biarkan kosong bila tanpa diskon</p>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <input
                    type="checkbox"
                    id={`pop-${idx}`}
                    checked={p.popular}
                    onChange={(e) => updatePlan(idx, { popular: e.target.checked })}
                    className="h-4 w-4 accent-white"
                  />
                  <label htmlFor={`pop-${idx}`} className="text-[13.5px] text-zinc-300">
                    Tandai populer
                  </label>
                </div>
                <div className="text-[13px] tabular-nums text-zinc-500 pb-1">
                  {p.prompts > 0 ? `≈ ${rupiah(Math.round(p.amount / p.prompts))} / prompt` : "-"}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlan(idx)}
                    className="h-8 text-[13px] text-rose-300 hover:bg-rose-500/10 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pembayaran */}
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <CardTitle className={`${tCard} flex items-center gap-2`}>
            <QrCode className="h-3.5 w-3.5 text-violet-400" />
            Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className={`${cardContentCls} grid gap-4`}>
          <div className="space-y-2">
            <Label className={tLabel}>QRIS (URL gambar, data URL, atau teks payload)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={qrisFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleQrisFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => qrisFileRef.current?.click()}
                className="h-8 border-white/10 bg-white/[0.04] text-[13px] gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Upload gambar QRIS
              </Button>
              {pricing.payment_qris && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange({ ...pricing, payment_qris: "" });
                    setQrisError(null);
                  }}
                  className="h-8 text-[13px] text-zinc-400 hover:bg-white/[0.05] gap-1.5"
                >
                  <ImageOff className="h-3.5 w-3.5" /> Hapus
                </Button>
              )}
              <span className="text-[12px] tabular-nums text-zinc-600">
                {pricing.payment_qris
                  ? `${(pricing.payment_qris.length / 1000).toFixed(1)} ribu karakter`
                  : "belum diisi"}
              </span>
            </div>
            {qrisError && (
              <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-300">
                {qrisError}
              </p>
            )}
            {(() => {
              const v = pricing.payment_qris || "";
              const isImg =
                v.startsWith("data:image/") ||
                /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?|$)/i.test(v);
              if (!v) return null;
              if (!isImg)
                return (
                  <p className="text-[12.5px] text-zinc-500">
                    Teks terdeteksi - akan ditampilkan sebagai payload QRIS.
                  </p>
                );
              return (
                <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v}
                    alt="Preview QRIS"
                    className="h-24 w-24 rounded-md bg-white object-contain p-1"
                  />
                  <span className="text-[12.5px] text-zinc-500">Pratinjau gambar QRIS.</span>
                </div>
              );
            })()}
            <Textarea
              rows={3}
              value={pricing.payment_qris}
              onChange={(e) => {
                setQrisError(null);
                onChange({ ...pricing, payment_qris: e.target.value });
              }}
              placeholder="https://... atau data:image/png;base64,..."
              className={textareaCls}
            />
            <p className="text-[12.5px] text-zinc-500">
              Tempel URL gambar QRIS atau data URL. Kalau teks biasa, ditampilkan sebagai payload.
              Disarankan upload gambar (&lt; 500 KB).
            </p>
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>Kuota harian default (tanpa paket)</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={String(pricing.default_daily_prompts ?? 20)}
              onChange={(e) =>
                onChange({
                  ...pricing,
                  default_daily_prompts: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                })
              }
              placeholder="20"
              className={inputCls}
            />
            <p className="text-[12.5px] leading-relaxed text-zinc-500">
              Batas prompt/hari (reset 00:00 WIB) untuk user yang belum punya paket paid. Minimal 1
              — angka 0 tidak lagi berarti unlimited; untuk akses tanpa batas gunakan tombol{" "}
              <span className="text-zinc-300">Unlimited</span> di tab Users. Paket paid tetap
              memakai batas paketnya sendiri.
            </p>
          </div>
          <div className="space-y-2">
            <Label className={tLabel}>Instruksi pembayaran</Label>
            <Textarea
              rows={3}
              value={pricing.payment_instructions}
              onChange={(e) => onChange({ ...pricing, payment_instructions: e.target.value })}
              placeholder="Bayar dengan nominal persis. Kuota aktif otomatis begitu pembayaran tercatat."
              className={textareaCls}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className={tLabel}>Kontak admin</Label>
              <Input
                value={pricing.contact}
                onChange={(e) => onChange({ ...pricing, contact: e.target.value })}
                placeholder="WhatsApp 08xx / email"
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label className={tLabel}>Catatan di halaman harga</Label>
              <Input
                value={pricing.order_note}
                onChange={(e) => onChange({ ...pricing, order_note: e.target.value })}
                placeholder="Catatan untuk pembeli (opsional)..."
                className={inputCls}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {formError && (
          <p className="w-full rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-300">
            {formError}
          </p>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-10 bg-white px-6 text-[15px] font-semibold text-black hover:bg-zinc-200"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Simpan Harga & Paket
        </Button>
      </div>

      {/* Orders */}
      <Card className={cardBase}>
        <CardHeader className={cardHeaderCls}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className={`${tCard} flex items-center gap-2`}>
              <Receipt className="h-3.5 w-3.5 text-sky-400" />
              Log Pembayaran
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {(["pending", "paid", "cancelled", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${filter === f ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"}`}
                  >
                    {f === "pending"
                      ? `Menunggu (${counts.pending})`
                      : f === "paid"
                        ? `Aktif (${counts.paid})`
                        : f === "cancelled"
                          ? `Batal (${counts.cancelled})`
                          : "Semua"}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadOrders}
                disabled={loadingOrders}
                className="h-8 border-white/10 bg-white/[0.04] text-[13px] gap-1.5"
              >
                {loadingOrders ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}{" "}
                Muat ulang
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {counts.pending > 0 && (
            <p className="px-5 pt-4 text-[12.5px] leading-relaxed text-zinc-500">
              {counts.pending} order <span className="font-medium text-amber-300">Menunggu</span> -
              dana belum tercatat masuk. Konfirmasi manual hanya jaga-jaga bila pembayaran sudah
              masuk tapi notifikasi gateway tidak sampai; batalkan bila menggantung.
            </p>
          )}
          {visible.length === 0 ? (
            <div className="p-6 text-[14px] text-zinc-500">Tidak ada order pada filter ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Paket
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Nominal
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Tanggal
                    </th>
                    <th className="px-5 py-3 text-right text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {visible.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 text-[14px] text-zinc-200">
                        {o.display_name || o.username || "-"}
                        <div className="text-[12px] text-zinc-500">{o.username}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-zinc-200">
                        {o.plan_label || o.plan_id}
                        <div className="text-[12px] text-zinc-500">
                          {o.prompts} prompt ·{" "}
                          {o.days && o.days > 0
                            ? o.status === "paid"
                              ? `${o.days} hari${o.expires_in_days !== null && o.expires_in_days !== undefined ? ` · sisa ${o.expires_in_days} hari` : ""}`
                              : `${o.days} hari`
                            : "tanpa batas waktu"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] tabular-nums text-zinc-300">
                        {rupiah(o.amount)}
                      </td>
                      <td className="px-4 py-3.5">
                        {o.status === "paid" ? (
                          <span
                            className={`inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide ${cEmerald}`}
                          >
                            AKTIF
                          </span>
                        ) : o.status === "cancelled" ? (
                          <span
                            className={`inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide ${cRose}`}
                          >
                            DIBATALKAN
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide ${cAmber}`}
                          >
                            MENUNGGU
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-zinc-500">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        {o.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => act(o.id, "confirm")}
                              disabled={busyId === o.id}
                              className="h-8 bg-white text-[13px] text-black hover:bg-zinc-200 gap-1.5"
                            >
                              {busyId === o.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}{" "}
                              Konfirmasi
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => act(o.id, "cancel")}
                              disabled={busyId === o.id}
                              className="h-8 border-white/10 bg-white/[0.04] text-[13px] text-zinc-300 gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" /> Batalkan
                            </Button>
                          </div>
                        ) : (
                          <div className="text-right text-[12.5px] text-zinc-500">
                            {o.paid_at
                              ? `Dibayar ${new Date(o.paid_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}`
                              : "-"}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
