"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, Copy, LogIn, X } from "lucide-react";
import Image from "next/image";

export type QuotaOfferVariant = "quota" | "trial" | "login";

const PACKAGES = [
  { prompts: 100, price: "Rp30.000", popular: false },
  { prompts: 200, price: "Rp50.000", popular: true },
  { prompts: 1000, price: "Rp500.000", popular: false },
];

const SPRING = { type: "spring" as const, stiffness: 420, damping: 26 };

const COPY = {
  quota: {
    label: "Kuota terpakai",
    title: "Prompt kamu habis",
    desc: "Paketmu sudah dipakai semua. Ambil paket baru untuk melanjutkan percakapan dari titik terakhir.",
    cta: "Hubungi admin",
  },
  trial: {
    label: "Trial selesai",
    title: "Masa trial berakhir",
    desc: "Prompt trial sudah habis. Ambil paket dan lanjutkan percakapan dengan kuota sendiri.",
    cta: "Ambil paket",
  },
  login: {
    label: "Akses akun",
    title: "Login diperlukan",
    desc: "Masuk ke akunmu untuk memakai kuota prompt yang sudah dibeli.",
    cta: "Login sekarang",
  },
} as const;

export default function QuotaOfferModal({
  open,
  variant,
  username,
  used,
  max,
  onClose,
}: {
  open: boolean;
  variant: QuotaOfferVariant;
  username?: string | null;
  used?: number | null;
  max?: number | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number>(200);
  const t = COPY[variant];
  const chosen = PACKAGES.find((p) => p.prompts === selected) ?? PACKAGES[1];
  const hasCount = typeof used === "number" && typeof max === "number" && max > 0;
  const pct = hasCount ? Math.min(100, Math.round((used! / max!) * 100)) : 100;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(id);
  }, [copied]);

  const handleContact = async () => {
    const text = `Halo admin ITZ AI, saya mau ambil paket ${chosen.prompts} prompt (${chosen.price}).${username ? ` Username: ${username}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Salin pesan ini dan kirim ke admin ITZ AI:", text);
    }
  };

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 28 } },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[5px]"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.9 }}
            className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c10] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)]"
          >
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="absolute right-3.5 top-3.5 z-10 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="px-6 pb-6 pt-7 sm:px-8 sm:pb-7"
            >
              {/* header */}
              <motion.div variants={item} className="flex items-center gap-2.5">
                <Image src="/image/favicon.png" alt="ITZ" width={20} height={20} className="h-5 w-5 rounded object-cover" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  ITZ AI · {t.label}
                </span>
              </motion.div>

              <motion.h2 variants={item} className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-white">
                {t.title}
              </motion.h2>
              <motion.p variants={item} className="mt-2 max-w-[440px] text-[14.5px] leading-relaxed text-zinc-400">
                {t.desc}
              </motion.p>

              {/* status kuota */}
              {variant !== "login" && (
                <motion.div variants={item} className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-zinc-400">Kuota terpakai</span>
                    <span className="font-medium tabular-nums text-zinc-200">{hasCount ? `${used} / ${max} prompt` : `${pct}%`}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      className="h-full rounded-full bg-white/70"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </motion.div>
              )}

              {/* paket */}
              {variant !== "login" && (
                <motion.div variants={item} role="radiogroup" aria-label="Pilih paket" className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {PACKAGES.map((p) => {
                    const active = selected === p.prompts;
                    return (
                      <motion.button
                        key={p.prompts}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelected(p.prompts)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                        className={`relative cursor-pointer rounded-xl border p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                          active
                            ? "border-white bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_12px_32px_-12px_rgba(255,255,255,0.25)]"
                            : "border-white/[0.08] bg-transparent hover:border-white/[0.2] hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">
                          {p.prompts}
                        </div>
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                          prompt
                        </div>
                        <div className="mt-3 border-t border-white/[0.07] pt-3 text-[15px] font-medium tabular-nums text-zinc-200">
                          {p.price}
                        </div>
                        <motion.span
                          aria-hidden
                          initial={false}
                          animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                          transition={SPRING}
                          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </motion.span>
                        {p.popular && !active && (
                          <span className="absolute right-3 top-3 rounded border border-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300">
                            Populer
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* CTA */}
              <motion.div variants={item} className="mt-5 space-y-2.5">
                {variant === "login" ? (
                  <a
                    href="/login"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-black transition-colors hover:bg-zinc-200"
                  >
                    <LogIn className="h-4 w-4" /> {t.cta}
                  </a>
                ) : (
                  <button
                    onClick={handleContact}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-black transition-colors hover:bg-zinc-200"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span key="ok" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex items-center gap-2">
                          <Check className="h-4 w-4" /> Tersalin, kirim ke admin
                        </motion.span>
                      ) : (
                        <motion.span key="cta" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex items-center gap-2">
                          <Copy className="h-4 w-4" /> {t.cta}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                )}

                {variant === "trial" && (
                  <a
                    href="/login"
                    className="flex items-center justify-center gap-1 text-[14px] text-zinc-400 transition-colors hover:text-white"
                  >
                    Sudah punya akun? Login <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}

                <button
                  onClick={onClose}
                  className="h-10 w-full rounded-xl text-[14px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                >
                  Nanti dulu
                </button>
              </motion.div>

              <motion.p variants={item} className="mt-4 text-center text-[12px] leading-relaxed text-zinc-600">
                Aktivasi manual oleh admin setelah pembayaran. Sisa kuota dicek lewat ikon info di halaman chat.
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
