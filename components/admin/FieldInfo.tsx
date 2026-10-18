"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Tombol "i" kecil di samping label field. Klik untuk buka penjelasan singkat
 * isi kolom. Klik di luar / tekan Escape untuk tutup. Sengaja berbasis klik
 * (bukan hover) supaya tetap berfungsi di layar sentuh.
 */
export function FieldInfo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Info kolom"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault(); // jangan sampai memicu aksi label induk (mis. toggle checkbox)
          setOpen((v) => !v);
        }}
        className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
          open
            ? "border-white/30 bg-white/15 text-zinc-100"
            : "border-white/15 bg-white/[0.04] text-zinc-500 hover:border-white/30 hover:bg-white/[0.08] hover:text-zinc-200"
        }`}
      >
        <Info className="h-2.5 w-2.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-left text-[13px] leading-relaxed text-zinc-300 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)]"
        >
          {text}
        </span>
      )}
    </div>
  );
}
