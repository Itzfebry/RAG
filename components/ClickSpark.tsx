"use client";

import { useEffect, useRef } from "react";

type Spark = { x: number; y: number; angle: number; start: number };

/** React Bits–style click feedback: garis kecil mekar dari titik klik. */
export default function ClickSpark({
  color = "#c4b5fd",
  size = 22,
  count = 10,
  duration = 420,
}: {
  color?: string;
  size?: number;
  count?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let sparks: Spark[] = [];
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Kanvas sengaja tidak dialokasikan sampai klik pertama: layer full-screen
    // yang selalu ada membebani compositor walau kosong.
    canvas.style.display = "none";
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.display = "block";
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparks = sparks.filter((spark) => now - spark.start < duration);

      for (const spark of sparks) {
        const p = (now - spark.start) / duration;
        const distance = size * (1 - Math.pow(1 - p, 3));
        const x = spark.x + Math.cos(spark.angle) * distance;
        const y = spark.y + Math.sin(spark.angle) * distance;
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(spark.angle) * size * 0.55,
          y + Math.sin(spark.angle) * size * 0.55,
        );
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      raf = sparks.length ? requestAnimationFrame(draw) : 0;
    };

    const onClick = (event: MouseEvent) => {
      if ((event as PointerEvent).pointerType === "touch") return;
      if (
        canvas.width !== window.innerWidth * dpr ||
        canvas.height !== window.innerHeight * dpr
      ) {
        resize();
      }
      const start = performance.now();
      for (let i = 0; i < count; i += 1) {
        sparks.push({
          x: event.clientX,
          y: event.clientY,
          angle: (Math.PI * 2 * i) / count + Math.random() * 0.2,
          start,
        });
      }
      if (!raf) raf = requestAnimationFrame(draw);
    };

    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
    };
  }, [color, count, duration, size]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] h-dvh w-screen"
    />
  );
}
