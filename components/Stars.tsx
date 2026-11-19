"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Kepadatan bintang per piksel² (desktop ~1 bintang / 6500px²). */
  density?: number;
  color?: string;
  accent?: string;
};

/**
 * Latar bintang ala React Bits "Stars" (space theme), tanpa canvas loop berat:
 * - digambar ulang ~9×/detik (bukan tiap frame) → kilau halus, biaya kecil.
 * - berhenti saat keluar viewport; prefers-reduced-motion = sekali gambar, statis.
 */
export default function Stars({ density = 0.00015, color = "#ffffff", accent = "#c4b5fd" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let stars: { x: number; y: number; r: number; a: number; ph: number; sp: number }[] = [];
    let raf = 0;
    let last = 0;
    let visible = false;

    const build = () => {
      const count = Math.min(420, Math.round(w * h * density));
      stars = Array.from({ length: count }, () => {
        const big = Math.random() > 0.94;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: big ? 1 + Math.random() * 1.1 : 0.3 + Math.random() * 0.8,
          a: 0.25 + Math.random() * 0.6,
          ph: Math.random() * Math.PI * 2,
          sp: 0.4 + Math.random() * 1.2,
        };
      });
    };

    const paint = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const t = reduce ? 1 : 0.6 + 0.4 * Math.sin(s.ph + time * 0.0006 * s.sp);
        ctx.beginPath();
        ctx.globalAlpha = s.a * t;
        ctx.fillStyle = s.r > 1 ? accent : color;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      if (time - last < 110) return; // ~9fps: cukup untuk kilau
      last = time;
      paint(time);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      paint(0);
    };

    const observer = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      if (visible && !reduce) last = 0;
    });
    observer.observe(canvas);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [density, color, accent]);

  return <canvas ref={ref} aria-hidden className="size-full" />;
}
