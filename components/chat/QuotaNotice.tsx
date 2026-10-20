"use client";

import { AnimatePresence, m } from "framer-motion";

// LazyMotion renders `m` components; alias keeps all call sites unchanged.
const motion = m;
import { X, Zap } from "lucide-react";

/**
 * Notice penggunaan habis bergaya ChatGPT: muncul inline di dalam percakapan
 * dan tetap terlihat di atas input sampai kuota diisi ulang.
 */
export default function QuotaNotice({
  visible,
  onOpenOffer,
  onDismiss,
}: {
  visible: boolean;
  onOpenOffer: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: 6, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/[0.12] bg-zinc-900"
            >
              <Zap className="h-3.5 w-3.5 text-zinc-300" />
            </motion.span>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight text-zinc-100">
                Batas prompt tercapai
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                Kuota kamu sudah habis. Ambil paket baru untuk melanjutkan percakapan.
              </p>
              <button
                onClick={onOpenOffer}
                className="mt-2.5 inline-flex h-8 items-center justify-center rounded-lg bg-white px-3.5 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200"
              >
                Lihat paket
              </button>
            </div>

            <motion.button
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              onClick={onDismiss}
              aria-label="Tutup info kuota"
              className="shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
