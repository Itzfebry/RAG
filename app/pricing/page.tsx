"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Loader2,
  QrCode,
  Sparkles,
  ArrowLeft,
  Clock,
  X,
  Receipt,
  MessageCircle,
} from "lucide-react";
import { ApiError, apiErrorMessage, fetchApi, tryFetch } from "@/lib/fetch-api";

export type Plan = {
  id: string;
  label: string;
  prompts: number;
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
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
  const activeId = useMemo(
    () => selected ?? plans.find((p) => p.popular)?.id ?? plans[0]?.id ?? null,
    [selected, plans],
  );
  const chosen = plans.find((p) => p.id === activeId) ?? null;

  const createOrder = async () => {
    if (!chosen || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const r = await tryFetch<{
        order?: OrderRow | null;
        payment_url?: string;
        detail?: string;
      }>("/api/python/user/orders", { json: { plan_id: chosen.id } }, "Gagal membuat order");
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
      setSubmitting(false);
    }
  };

  // Aktivasi datang dari callback gateway, bukan klik user: poll status order
  // selama modal terbuka sampai "paid" (kuota sudah ditambah backend).
  useEffect(() => {
    if (!showQris || !order) return;
    const tick = () => {
      fetchApi<{ items?: OrderRow[] }>("/api/python/user/orders")
        .then((j) => {
          const row = (Array.isArray(j.items) ? j.items : []).find((o) => o.id === order.id);
          if (row && row.status === "paid") {
            setShowQris(false);
            setOrder(null);
            setNotice(
              `Pembayaran tercatat otomatis. Kuota ${chosen ? `${chosen.prompts} prompt` : "paket"} sudah aktif.`,
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
  }, [showQris, order, chosen, loadOrders]);

  const waHref = (msg: string) =>
    data?.contact_wa ? `${data.contact_wa}?text=${encodeURIComponent(msg)}` : null;

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
    "Pilih paket, lalu klik Ambil paket — halaman pembayaran langsung terbuka.",
    "Bayar dengan nominal persis lewat QRIS, VA, atau e-wallet.",
    "Tunggu sebentar — kuota aktif otomatis begitu pembayaran tercatat di sistem. Tidak perlu klik apa pun.",
    "Ada kendala? Chat admin lewat WhatsApp. Konfirmasi admin hanya cadangan bila notifikasi gangguan.",
  ];

  return (
    <main className="relative mx-auto min-h-screen max-w-[1000px] px-5 py-10 text-zinc-200">
      <header className="mb-9 flex flex-wrap items-center justify-between gap-3">
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
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-50">Harga & Paket</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Kuota prompt ITZ AI. Kuota aktif otomatis begitu pembayaran tercatat — tanpa
              konfirmasi manual.
            </p>
          </div>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Ke chat
        </Link>
      </header>

      {user && (
        <section className="mb-7 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-zinc-400">
          Kamu login sebagai{" "}
          <span className="font-medium text-zinc-200">{user.display_name || user.username}</span>.
          {typeof user.remaining === "number" ? (
            <>
              {" "}
              Sisa kuota saat ini{" "}
              <span className="font-medium tabular-nums text-emerald-300">
                {user.remaining}
              </span>{" "}
              prompt.
            </>
          ) : (
            <>
              {" "}
              Kuota akunmu <span className="text-zinc-300">tanpa batas</span>.
            </>
          )}
        </section>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          Gagal memuat harga: {error}
        </p>
      )}
      {!error && !data && (
        <p className="flex items-center gap-2 text-[13px] text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat paket...
        </p>
      )}

      {data && plans.length > 0 && (
        <section
          aria-label="Pilih paket"
          role="radiogroup"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-3"
        >
          {plans.map((p) => {
            const active = activeId === p.id;
            const perPrompt = p.prompts > 0 ? Math.round(p.amount / p.prompts) : 0;
            // Diskon aktif hanya kalau harga coret di atas harga akhir.
            const off =
              typeof p.discount_percent === "number" &&
              p.discount_percent > 0 &&
              typeof p.original_amount === "number" &&
              p.original_amount > p.amount;
            return (
              <motion.button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(p.id)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
                className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  active
                    ? "border-white bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_16px_44px_-16px_rgba(255,255,255,0.22)]"
                    : "border-white/[0.08] bg-[#111114] hover:border-white/[0.2] hover:bg-white/[0.03]"
                }`}
              >
                {p.popular && !active && (
                  <span className="absolute right-4 top-4 flex items-center gap-1 rounded border border-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300">
                    <Sparkles className="h-2.5 w-2.5" /> Populer
                  </span>
                )}
                <AnimatePresence>
                  {active && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
                <p className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-zinc-500">
                  {p.label}
                  {off && (
                    <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                      Hemat {p.discount_percent}%
                    </span>
                  )}
                </p>
                <p className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">
                  {p.prompts}
                  <span className="ml-1.5 text-[13px] font-normal text-zinc-500">prompt</span>
                </p>
                <p className="mt-3 flex items-baseline gap-2 border-t border-white/[0.07] pt-3">
                  <span className="text-[17px] font-medium tabular-nums text-zinc-200">
                    {rupiah(p.amount)}
                  </span>
                  {off && (
                    <span className="text-[13px] tabular-nums text-zinc-600 line-through">
                      {rupiah(p.original_amount!)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[12px] tabular-nums text-zinc-500">
                  {perPrompt > 0 ? `≈ ${rupiah(perPrompt)} / prompt` : "Harga khusus"}
                </p>
              </motion.button>
            );
          })}
        </section>
      )}

      {data && plans.length === 0 && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
          Belum ada paket aktif. Hubungi admin{data.contact ? ` (${data.contact})` : ""}.
        </p>
      )}

      {data && plans.length > 0 && (
        <section className="mt-7 flex flex-col items-center gap-3">
          {user ? (
            <>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={createOrder}
                disabled={submitting || !chosen}
                className="flex h-12 w-full max-w-[360px] items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Ambil paket{chosen ? ` ${chosen.prompts} prompt` : ""}
              </motion.button>
              {data.order_note && (
                <p className="max-w-[460px] text-center text-[12.5px] leading-relaxed text-zinc-500">
                  {data.order_note}
                </p>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className="flex h-12 w-full max-w-[360px] items-center justify-center rounded-xl bg-white text-[15px] font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              Login untuk membeli paket
            </Link>
          )}
          {notice && (
            <p className="max-w-[520px] text-center text-[13px] text-emerald-300">{notice}</p>
          )}
        </section>
      )}

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h2 className="mb-3 text-[14px] font-medium text-zinc-200">Cara pembelian</h2>
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-zinc-400">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h2 className="mb-3 text-[14px] font-medium text-zinc-200">Pembayaran</h2>
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
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-zinc-200">
            <Receipt className="h-4 w-4 text-zinc-500" /> Order kamu
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.08]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
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
                    const badge =
                      o.status === "paid"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : o.status === "cancelled"
                          ? "border-red-500/20 bg-red-500/10 text-red-300"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-300";
                    return (
                      <tr key={o.id}>
                        <td className="px-4 py-3 text-[13.5px] text-zinc-200">
                          {o.plan_label || o.plan_id}
                          <span className="ml-1.5 text-zinc-500">· {o.prompts} prompt</span>
                        </td>
                        <td className="px-4 py-3 text-[13.5px] tabular-nums text-zinc-300">
                          {rupiah(o.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${badge}`}
                          >
                            {o.status === "paid"
                              ? "AKTIF"
                              : o.status === "cancelled"
                                ? "DIBATALKAN"
                                : "BELUM DIBAYAR"}
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
                <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-white">
                  {payUrl ? "Selesaikan pembayaran" : "Scan untuk bayar"}
                </h2>
                {chosen && (
                  <p className="mt-1.5 text-[14px] text-zinc-400">
                    {chosen.label} ·{" "}
                    <span className="font-medium tabular-nums text-zinc-200">
                      {rupiah(chosen.amount)}
                    </span>
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
