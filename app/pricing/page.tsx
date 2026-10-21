"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";

// LazyMotion renders `m` components; alias keeps all call sites unchanged.
const motion = m;
import {
  Check,
  Copy,
  Loader2,
  QrCode,
  Sparkles,
  ArrowLeft,
  Clock,
  Timer,
  X,
  Receipt,
  MessageCircle,
  Zap,
  ShieldCheck,
  Gem,
  Leaf,
  Rocket,
  Layers,
} from "lucide-react";
import { ApiError, apiErrorMessage, fetchApi, tryFetch } from "@/lib/fetch-api";

export type Plan = {
  id: string;
  label: string;
  prompts: number;
  days?: number | null;
  amount: number;
  popular?: boolean;
  original_amount?: number | null;
  discount_percent?: number | null;
};

export type PricingData = {
  plans: Plan[];
  payment_qris: string;
  payment_instructions: string;
  contact: string;
  contact_wa: string;
  order_note: string;
};

type UserInfo = {
  username?: string;
  display_name?: string | null;
  remaining?: number | null;
  max_prompts?: number | null;
} | null;

type OrderRow = {
  id: string;
  plan_id: string;
  plan_label?: string;
  prompts: number;
  days?: number | null;
  expired?: boolean;
  expires_in_days?: number | null;
  amount: number;
  status: string;
  created_at?: string;
  paid_at?: string | null;
};

export const rupiah = (n: number) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function PricingPage() {
  const [data, setData] = useState<PricingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showQris, setShowQris] = useState(false);
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<OrderRow | null>(null);
  // Halaman bayar gateway (QRIS/VA/e-wallet). Null = gateway nonaktif (QRIS manual).
  const [payUrl, setPayUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<PricingData>("/api/python/pricing")
      .then((d) => setData(d))
      .catch((e) => {
        // HTTP gagal -> pesan "Server <status>" seperti versi lama;
        // koneksi gagal langsung menampilkan fallback Indonesia.
        if (e instanceof ApiError && e.status > 0) {
          setError(`Server ${e.status}`);
        } else {
          setError(apiErrorMessage(e, "Gagal terhubung ke server"));
        }
      });
  }, []);

  useEffect(() => {
    fetchApi<UserInfo>("/api/python/user/me")
      .then(setUser)
      .catch(() => {});
  }, []);

  const loadOrders = React.useCallback(() => {
    fetchApi<{ items?: unknown[] }>("/api/python/user/orders")
      .then((j) => {
        setOrders(Array.isArray(j.items) ? (j.items as OrderRow[]) : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) loadOrders();
  }, [user, loadOrders]);

  const plans = data?.plans ?? [];

  const createOrder = async (plan: Plan) => {
    if (submitting) return;
    setSubmitting(plan.id);
    setNotice(null);
    setActivePlan(plan);
    try {
      const r = await tryFetch<{
        order?: OrderRow | null;
        payment_url?: string;
        detail?: string;
      }>("/api/python/user/orders", { json: { plan_id: plan.id } }, "Gagal membuat order");
      if (!r.ok) {
        setNotice(r.error);
        return;
      }
      setOrder(r.data.order ?? null);
      setPayUrl(
        typeof r.data.payment_url === "string" && r.data.payment_url ? r.data.payment_url : null,
      );
      setShowQris(true);
      loadOrders();
    } catch {
      setNotice("Gagal membuat order");
    } finally {
      setSubmitting(null);
    }
  };

  // Aktivasi datang dari callback gateway, bukan klik user: poll status order
  // selama modal terbuka sampai "paid" (kuota sudah ditambah backend).
  useEffect(() => {
    if (!showQris || !order) return;
    const plan = activePlan;
    const tick = () => {
      fetchApi<{ items?: OrderRow[] }>("/api/python/user/orders")
        .then((j) => {
          const row = (Array.isArray(j.items) ? j.items : []).find((o) => o.id === order.id);
          if (row && row.status === "paid") {
            setShowQris(false);
            setOrder(null);
            setNotice(
              `Pembayaran tercatat otomatis. Paket ${plan ? plan.label : ""} (${
                plan
                  ? `${plan.prompts} prompt/hari${plan.days ? `, ${plan.days} hari` : ""}`
                  : "aktif"
              }) sudah menyala.`,
            );
            loadOrders();
            fetchApi<UserInfo>("/api/python/user/me")
              .then(setUser)
              .catch(() => {});
          }
        })
        .catch(() => {});
    };
    const t = setInterval(tick, 4000);
    tick();
    return () => clearInterval(t);
  }, [showQris, order, activePlan, loadOrders]);

  const waHref = (msg: string) =>
    data?.contact_wa ? `${data.contact_wa}?text=${encodeURIComponent(msg)}` : null;

  const chosen = activePlan;
  const receiptMsg = `Halo admin ITZ AI, saya sudah bayar ${chosen ? `${chosen.label} (${rupiah(chosen.amount)})` : "paket prompt"}.${user?.username ? ` Username: ${user.username}` : ""}`;
  const receiptWa = waHref(receiptMsg);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  const steps = [
    "Klik Langganan sekarang pada kartu pilihanmu — halaman pembayaran langsung terbuka.",
    "Bayar dengan nominal persis lewat QRIS, VA, atau e-wallet.",
    "Tunggu sebentar — kuota aktif otomatis begitu pembayaran tercatat di sistem. Tidak perlu klik apa pun.",
    "Ada kendala? Chat admin lewat WhatsApp. Konfirmasi admin hanya cadangan bila notifikasi gangguan.",
  ];

  const planFeatures = (p: Plan) => {
    // prompts = kuota per hari; jadi total prompt selama masa aktif = prompts x days.
    const days = p.days && p.days > 0 ? p.days : 0;
    const totalPrompts = days > 0 ? p.prompts * days : 0;
    const perPrompt =
      days > 0 && p.prompts > 0
        ? Math.round(p.amount / totalPrompts)
        : p.prompts > 0
          ? Math.round(p.amount / p.prompts)
          : 0;
    const feats: Array<{ icon: React.ElementType | null; text: string }> = [
      { icon: Zap, text: `${p.prompts} prompt / hari` },
    ];
    if (perPrompt > 0) {
      feats.push({
        icon: null,
        text:
          days > 0
            ? `≈ ${rupiah(perPrompt)} / prompt (${totalPrompts.toLocaleString("id-ID")} prompt total)`
            : `≈ ${rupiah(perPrompt)} / prompt hari pertama`,
      });
    }
    feats.push({ icon: ShieldCheck, text: "Aktivasi otomatis, tanpa konfirmasi manual" });
    return feats;
  };

  return (
    <main className="relative mx-auto min-h-screen max-w-[1100px] px-5 py-10 text-zinc-200">
      {/* latar: glow radial halus + grid, senada estetika pricing LLM */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[420px] bg-[radial-gradient(600px_240px_at_50%_0%,rgba(139,92,246,0.14),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] opacity-[0.35] [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:72px_100%] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <header className="mb-12 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/[0.12] bg-zinc-900">
            <Image
              src="/image/favicon.png"
              alt="ITZ"
              width={40}
              height={40}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-zinc-50">ITZ AI</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Prompt marketplace · bayar sekali, pakai harian
            </p>
          </div>
        </div>
        <Link
          href="/chat"
          aria-label="Kembali ke chat"
          title="Kembali ke chat"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-zinc-300 transition-colors hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </header>

      {/* hero */}
      <section className="mx-auto mb-10 max-w-[640px] text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <Sparkles className="h-3 w-3 text-violet-300" /> Pricing
        </span>
        <h2 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[40px]">
          Pilih paket,{" "}
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-sky-300 bg-clip-text text-transparent">
            kuota langsung aktif
          </span>
        </h2>
      </section>

      {user && (
        <section className="mx-auto mb-7 max-w-[640px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-[13px] text-zinc-400">
          Login sebagai{" "}
          <span className="font-medium text-zinc-200">{user.display_name || user.username}</span>
          {typeof user.remaining === "number" ? (
            <>
              {" "}
              · sisa kuota hari ini{" "}
              <span className="font-medium tabular-nums text-emerald-300">
                {user.remaining}
              </span>{" "}
              prompt
            </>
          ) : (
            <>
              {" "}
              · kuota akunmu <span className="text-zinc-300">tanpa batas</span>
            </>
          )}
        </section>
      )}

      {error && (
        <p className="mx-auto max-w-[640px] rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-[13px] text-red-300">
          Gagal memuat harga: {error}
        </p>
      )}
      {!error && !data && (
        <p className="flex items-center justify-center gap-2 text-[13px] text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat paket...
        </p>
      )}

      {data && plans.length > 0 && (
        <section
          aria-label="Pilih paket"
          className="grid grid-cols-1 content-start gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {plans.map((p) => {
            // Ikon + warna per paket: terkecil -> daun (hijau), terpopuler ->
            // roket (emas), terbesar -> diamond (biru), sisanya layers.
            const rank = plans.filter((x) => Number(x.prompts) < Number(p.prompts)).length;
            const PlanIcon = p.popular
              ? Rocket
              : rank === 0
                ? Leaf
                : rank === plans.length - 1
                  ? Gem
                  : Layers;
            const planIconCls = p.popular
              ? "text-[#d4af37]"
              : rank === 0
                ? "text-emerald-400/90"
                : rank === plans.length - 1
                  ? "text-sky-400"
                  : "text-zinc-300";
            // Warna aksen masa aktif: gradient fuchsia-violet-sky, senada teks judul hero.
            const activeCls =
              "font-semibold bg-gradient-to-r from-fuchsia-400 via-violet-300 to-sky-400 bg-clip-text text-transparent";
            const off =
              typeof p.discount_percent === "number" &&
              p.discount_percent > 0 &&
              typeof p.original_amount === "number" &&
              p.original_amount > p.amount;
            const feats = planFeatures(p);
            const card = (
              <div
                className={`flex h-full flex-col rounded-2xl p-6 ${
                  p.popular ? "bg-[#0d0d12]" : "border border-white/[0.08] bg-[#111114]"
                }`}
              >
                {/* label + badge diskon */}
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-zinc-300">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] ${planIconCls}`}
                    >
                      <PlanIcon className="h-3.5 w-3.5" />
                    </span>
                    {p.label}
                  </p>
                  {off && (
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                      Hemat {p.discount_percent}%
                    </span>
                  )}
                </div>

                {/* harga besar ala pricing LLM */}
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">
                    {rupiah(p.amount)}
                  </span>
                  {off && (
                    <span className="text-[14px] tabular-nums text-zinc-600 line-through">
                      {rupiah(p.original_amount!)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12.5px] text-zinc-500">
                  sekali bayar · kuota {p.prompts} prompt/hari
                </p>

                {/* fitur paket */}
                <ul className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-5">
                  {feats.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[13.5px] leading-snug text-zinc-300"
                    >
                      {f.icon ? (
                        <f.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      ) : (
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80"
                          strokeWidth={2.5}
                        />
                      )}
                      <span>{f.text}</span>
                    </li>
                  ))}
                  {/* masa aktif: digabung di daftar keterangan bawah, warna mengikuti paket */}
                  <li className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                    <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
                    <span className={activeCls}>
                      {p.days && p.days > 0 ? `${p.days} hari masa aktif` : "Masa aktif selamanya"}
                    </span>
                  </li>
                </ul>

                {/* CTA per kartu */}
                <div className="mt-6 pt-1">
                  {user ? (
                    <motion.button
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => createOrder(p)}
                      disabled={submitting !== null}
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        p.popular
                          ? "bg-white text-black hover:bg-zinc-200"
                          : "border border-white/[0.14] bg-white/[0.04] text-zinc-100 hover:bg-white/[0.09]"
                      }`}
                    >
                      {submitting === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      Langganan sekarang
                    </motion.button>
                  ) : (
                    <Link
                      href="/login"
                      className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold transition-colors ${
                        p.popular
                          ? "bg-white text-black hover:bg-zinc-200"
                          : "border border-white/[0.14] bg-white/[0.04] text-zinc-100 hover:bg-white/[0.09]"
                      }`}
                    >
                      Login untuk membeli
                    </Link>
                  )}
                </div>
              </div>
            );

            return p.popular ? (
              <motion.div
                key={p.id}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
                className="relative rounded-2xl bg-gradient-to-b from-violet-400/50 via-white/[0.09] to-transparent p-[1.5px] shadow-[0_24px_60px_-28px_rgba(139,92,246,0.45)]"
              >
                <span className="absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_20px_-8px_rgba(139,92,246,0.7)]">
                  <Sparkles className="h-2.5 w-2.5" /> Paling populer
                </span>
                {card}
              </motion.div>
            ) : (
              <motion.div
                key={p.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.995 }}
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
                className="rounded-2xl transition-shadow hover:shadow-[0_20px_48px_-28px_rgba(255,255,255,0.18)]"
              >
                {card}
              </motion.div>
            );
          })}
        </section>
      )}

      {data && plans.length === 0 && (
        <p className="mx-auto max-w-[640px] rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-[13px] text-amber-200">
          Belum ada paket aktif. Hubungi admin{data.contact ? ` (${data.contact})` : ""}.
        </p>
      )}

      {data && plans.length > 0 && (
        <p className="mx-auto mt-6 max-w-[560px] text-center text-[12.5px] leading-relaxed text-zinc-600">
          {data.order_note ||
            "Semua pembayaran terverifikasi otomatis oleh sistem. Simpan bukti transfer sampai kuota menyala."}
        </p>
      )}

      <section className="mx-auto mt-14 grid max-w-[900px] grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h3 className="mb-4 text-[15px] font-semibold text-zinc-100">Cara pembelian</h3>
          <ol className="space-y-3 text-[13.5px] leading-relaxed text-zinc-400">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.14] text-[11px] font-semibold tabular-nums text-zinc-300">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h3 className="mb-4 text-[15px] font-semibold text-zinc-100">Pembayaran</h3>
          {data?.payment_qris || data?.payment_instructions ? (
            <div className="space-y-3 text-[13.5px] leading-relaxed text-zinc-400">
              {data?.payment_qris && (
                <button
                  onClick={() => setShowQris(true)}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-[13px] text-zinc-200 transition-colors hover:bg-white/[0.08]"
                >
                  <QrCode className="h-4 w-4" /> Lihat QRIS
                </button>
              )}
              {data?.payment_instructions && (
                <p className="whitespace-pre-wrap">{data.payment_instructions}</p>
              )}
              {data?.contact_wa ? (
                <a
                  href={`${data.contact_wa}?text=${encodeURIComponent("Halo admin ITZ AI, saya mau tanya soal pembayaran paket prompt.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-[13px] text-zinc-200 transition-colors hover:bg-white/[0.08]"
                >
                  <MessageCircle className="h-4 w-4" /> Chat admin via WhatsApp
                </a>
              ) : (
                data?.contact && (
                  <p>
                    Kontak admin: <span className="font-medium text-zinc-200">{data.contact}</span>
                  </p>
                )
              )}
            </div>
          ) : (
            <p className="text-[13.5px] leading-relaxed text-zinc-500">
              Info pembayaran belum diatur. Hubungi admin.
            </p>
          )}
        </div>
      </section>

      {user && orders.length > 0 && (
        <section className="mx-auto mt-12 max-w-[900px]">
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-zinc-200">
            <Receipt className="h-4 w-4 text-zinc-500" /> Order kamu
          </h3>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Paket
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Nominal
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      Tanggal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {orders.map((o) => {
                    const expiredNow = o.expired === true;
                    const badge =
                      o.status === "paid"
                        ? expiredNow
                          ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : o.status === "cancelled"
                          ? "border-red-500/20 bg-red-500/10 text-red-300"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-300";
                    const statusText =
                      o.status === "paid"
                        ? expiredNow
                          ? "MASA AKTIF HABIS"
                          : o.expires_in_days != null && o.expires_in_days > 0
                            ? `AKTIF · sisa ${o.expires_in_days} hari`
                            : "AKTIF"
                        : o.status === "cancelled"
                          ? "DIBATALKAN"
                          : "BELUM DIBAYAR";
                    return (
                      <tr key={o.id}>
                        <td className="px-4 py-3 text-[13.5px] text-zinc-200">
                          {o.plan_label || o.plan_id}
                          <span className="ml-1.5 text-zinc-500">
                            · {o.prompts} prompt
                            {o.days && o.days > 0 ? ` · ${o.days} hari` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13.5px] tabular-nums text-zinc-300">
                          {rupiah(o.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${badge}`}
                          >
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-zinc-500">
                          {o.created_at
                            ? new Date(o.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <AnimatePresence>
        {showQris && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-[5px]"
              onClick={() => setShowQris(false)}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Pembayaran QRIS"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.9 }}
              className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c10] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)]"
            >
              <button
                onClick={() => setShowQris(false)}
                aria-label="Tutup"
                className="absolute right-3.5 top-3.5 z-10 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="px-6 pb-6 pt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  ITZ AI · Pembayaran
                </p>
                <h3 className="mt-3 text-[22px] font-semibold tracking-tight text-white">
                  {payUrl ? "Selesaikan pembayaran" : "Scan untuk bayar"}
                </h3>
                {chosen && (
                  <p className="mt-1.5 text-[14px] text-zinc-400">
                    {chosen.label} ·{" "}
                    <span className="font-medium tabular-nums text-zinc-200">
                      {rupiah(chosen.amount)}
                    </span>
                    {chosen.days && chosen.days > 0 ? (
                      <span className="text-zinc-600"> · masa aktif {chosen.days} hari</span>
                    ) : null}
                  </p>
                )}

                {payUrl ? (
                  <p className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-[13px] leading-relaxed text-emerald-200">
                    Klik tombol di bawah untuk membuka halaman pembayaran. Kuota aktif otomatis
                    begitu dana masuk — tidak perlu konfirmasi apa pun.
                  </p>
                ) : data?.payment_qris ? (
                  data.payment_qris.startsWith("data:image") ||
                  data.payment_qris.startsWith("http") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.payment_qris}
                      alt="QRIS ITZ AI"
                      className="mx-auto mt-5 h-56 w-56 rounded-xl border border-white/[0.1] bg-white object-contain p-2"
                    />
                  ) : (
                    <div className="mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-xl border border-white/[0.1] bg-white p-3">
                      <p className="break-all text-center font-mono text-[10px] leading-tight text-black">
                        {data.payment_qris}
                      </p>
                    </div>
                  )
                ) : (
                  <p className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
                    Metode pembayaran belum diatur. Minta info pembayaran langsung ke admin.
                  </p>
                )}

                {data?.payment_instructions && (
                  <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">
                    {data.payment_instructions}
                  </p>
                )}

                <div className="mt-5 space-y-2.5">
                  {payUrl ? (
                    <a
                      href={payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-black transition-colors hover:bg-zinc-200"
                    >
                      <QrCode className="h-4 w-4" /> Bayar sekarang (QRIS, VA & e-wallet)
                    </a>
                  ) : (
                    <p className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-center text-[13px] leading-relaxed text-zinc-400">
                      Bayar dengan nominal persis, lalu tunggu. Pembayaran tercatat otomatis dan
                      kuota aktif sendiri.
                    </p>
                  )}
                  {receiptWa ? (
                    <a
                      href={receiptWa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.05]"
                    >
                      <MessageCircle className="h-4 w-4" /> Kirim bukti ke admin (WhatsApp)
                    </a>
                  ) : (
                    <button
                      onClick={() => copy(receiptMsg)}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.05]"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Tersalin, kirim ke admin" : "Salin ringkasan order"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowQris(false)}
                    className="h-10 w-full rounded-xl text-[14px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                  >
                    Tutup
                  </button>
                </div>

                <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-zinc-600">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Kuota aktif otomatis begitu pembayaran tercatat — tidak perlu klik apa pun. Simpan
                  bukti transfer sampai kuota bertambah; admin hanya jaga-jaga bila ada gangguan.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
