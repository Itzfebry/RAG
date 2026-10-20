"use client";

import React, { useCallback, useEffect, useState } from "react";

export interface TourStep {
  /** id elemen yang disorot (harus sudah ada di DOM saat tour dibuka) */
  target: string;
  title: string;
  desc: string;
}

interface Props {
  steps: TourStep[];
  onFinish: () => void;
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;

/**
 * Coach-mark sekali-jalan: sorot elemen fitur satu per satu.
 * Penanda (flag "sudah pernah lihat") disimpan pemanggil - komponen ini stateless
 * soal penyimpanan.
 */
export default function OnboardingTour({ steps, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const next = useCallback(() => {
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  }, [isLast, onFinish]);

  const measure = useCallback(() => {
    const el = document.getElementById(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setVp({ w: window.innerWidth, h: window.innerHeight });
  }, [step.target]);

  useEffect(() => {
    measure();
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    // elemen bisa belum stabil tepat setelah mount - ukur ulang sebentar lagi
    const id = window.setTimeout(measure, 150);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      window.clearTimeout(id);
    };
  }, [measure]);

  if (!step) return null;

  // Posisi kartu: di bawah target kalau ada ruang, kalau tidak di atasnya.
  const cardW = Math.min(320, vp.w - 24);
  let cardStyle: React.CSSProperties;
  if (rect && vp.w > 0) {
    const roomBelow = vp.h - (rect.top + rect.height) > 200;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vp.w - cardW - 12);
    cardStyle = roomBelow
      ? { top: rect.top + rect.height + 14, left, width: cardW }
      : { bottom: vp.h - rect.top + 14, left, width: cardW };
  } else {
    // fallback: kartu di tengah layar
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: cardW };
  }

  return (
    <div className="fixed inset-0 z-[96]">
      {rect ? (
        <>
          {/* Empat tirai gelap menyisakan lubang di sekitar elemen target */}
          <div
            className="pointer-events-auto fixed inset-x-0 top-0 bg-black/70"
            style={{ height: Math.max(0, rect.top) }}
          />
          <div
            className="pointer-events-auto fixed inset-x-0 bottom-0 bg-black/70"
            style={{ top: Math.max(0, rect.top + rect.height) }}
          />
          <div
            className="pointer-events-auto fixed left-0 bg-black/70"
            style={{ top: rect.top, width: Math.max(0, rect.left), height: rect.height }}
          />
          <div
            className="pointer-events-auto fixed right-0 bg-black/70"
            style={{ top: rect.top, left: rect.left + rect.width, height: rect.height }}
          />
          {/* Cincin sorot */}
          <div
            className="pointer-events-none fixed rounded-xl ring-2 ring-white/75"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Instruksi: ${step.title}`}
        className="fixed z-[97] rounded-2xl border border-white/[0.12] bg-[#16161c] p-4 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)]"
        style={cardStyle}
      >
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">
          Langkah {index + 1} dari {steps.length}
        </p>
        <p className="mt-1 text-[14.5px] font-semibold tracking-[-0.01em] text-white">
          {step.title}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{step.desc}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={onFinish}
            className="rounded-lg px-2 py-1.5 text-[12.5px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          >
            Lewati
          </button>
          <button
            onClick={next}
            className="h-8 rounded-lg bg-white px-4 text-[12.5px] font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            {isLast ? "Mengerti" : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
