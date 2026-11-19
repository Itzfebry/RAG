"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

export type OrbitItem = { name: string; logo?: string | null };

/**
 * Orbit ala atom React untuk daftar integrasi.
 * - 3 elips (0° / 60° / -60°), item bergerak di parameter elips.
 * - Satu ticker GSAP untuk semua item (transform + opacity saja).
 * - Berhenti total saat keluar viewport; prefers-reduced-motion = statis.
 */
// Tiga elips identik, hanya rotasinya berbeda (0° / 60° / 120°) — bentuk
// atom React yang simetris. Beda kecepatan & fasa supaya tidak terlihat
// seperti satu roda.
const RINGS = [
  { rx: 0.84, ry: 0.32, tilt: 0, speed: 0.2, phase: 0 },
  { rx: 0.84, ry: 0.32, tilt: 60, speed: -0.16, phase: Math.PI / 5 },
  { rx: 0.84, ry: 0.32, tilt: 120, speed: 0.24, phase: (Math.PI / 5) * 2 },
];

const SIZE = 640; // viewBox SVG
const CENTER = SIZE / 2;

// Comet: kepala tebal + ekor menipis, digambar sebagai deretan titik di
// sepanjang elips. Posisi dihitung `getPointAtLength` → gerak halus dan
// ekor selalu persis di atas garis orbit.
const COMET_DOTS = 20;
const COMET_HEAD = 6.6;
const COMET = Array.from({ length: COMET_DOTS }, (_, i) => {
  const k = i / (COMET_DOTS - 1);
  return {
    r: COMET_HEAD * (1 - k) ** 1.5 + 0.5,
    o: 0.95 * (1 - k) ** 1.6 + 0.05,
    f: i * 0.014, // fasa awal supaya titik tidak menumpuk sebelum JS jalan
  };
});

export default function IntegrationOrbit({ items }: { items: OrbitItem[] }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrap.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".orbit-node"));
    const comets = Array.from(root.querySelectorAll<SVGGElement>(".orbit-comet")).map(g => {
      const path = g.querySelector<SVGEllipseElement>(".orbit-measure");
      const dots = Array.from(g.querySelectorAll<SVGCircleElement>(".orbit-dot"));
      return {
        g,
        path,
        dots,
        vel: Number(g.dataset.vel),
        L: path ? path.getTotalLength() : 0,
      };
    });
    const nucleus = root.querySelector<HTMLElement>(".orbit-core");
    if (!nodes.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { rx: 1, ry: 1, t: 0, hovering: false, alive: true, visible: true };

    const measure = () => {
      const { width, height } = root.getBoundingClientRect();
      state.rx = Math.min(width, height) / 2;
      state.ry = state.rx;
    };

    const place = () => {
      nodes.forEach(node => {
        const ring = Number(node.dataset.ring);
        const base = Number(node.dataset.angle);
        const config = RINGS[ring];
        const angle = base + state.t * config.speed;
        const x = Math.cos(angle) * state.rx * config.rx;
        const y = Math.sin(angle) * state.ry * config.ry;
        const depth = Math.sin(angle); // -1 belakang, 1 depan
        const hovered = node.dataset.hover === "1";
        const scale = (0.78 + 0.24 * (depth * 0.5 + 0.5)) * (hovered ? 1.18 : 1);
        const opacity = hovered ? 1 : 0.32 + 0.68 * (depth * 0.5 + 0.5);
        node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        node.style.opacity = String(opacity);
        node.style.zIndex = hovered ? "60" : String(10 + Math.round(depth * 5));
      });
      // Comet: posisi tiap titik dari getPointAtLength. Kepala di depan,
      // ekor memanjang ke belakang (arah gerak) dan makin kecil/redup.
      comets.forEach(({ path, dots, vel, L }) => {
        if (!path || !L) return;
        const dir = vel < 0 ? -1 : 1;
        const gap = L * 0.0092;
        for (let j = 0; j < dots.length; j++) {
          const raw = state.t * vel - dir * j * gap;
          const pos = ((raw % L) + L) % L;
          const p = path.getPointAtLength(pos);
          dots[j].setAttribute("cx", p.x.toFixed(2));
          dots[j].setAttribute("cy", p.y.toFixed(2));
        }
      });
      if (nucleus) {
        const pulse = reduce ? 1 : 1 + Math.sin(state.t * 1.3) * 0.02;
        nucleus.style.transform = `translate(-50%, -50%) scale(${pulse})`;
      }
    };

    const tick = (_time: number, delta: number) => {
      if (!state.alive || !state.visible) return;
      state.t += (Math.min(delta, 50) / 1000) * (state.hovering ? 0.15 : 1);
      place();
    };

    measure();
    place();
    if (!reduce) gsap.ticker.add(tick);

    // Hover per-logo: logo membesar, orbit melambat, z-index naik.
    const onOver = (event: Event) => {
      const node = (event.target as HTMLElement).closest<HTMLElement>(".orbit-node");
      if (!node) return;
      node.dataset.hover = "1";
      state.hovering = true;
      place();
    };
    const onOut = (event: Event) => {
      const node = (event.target as HTMLElement).closest<HTMLElement>(".orbit-node");
      if (!node) return;
      delete node.dataset.hover;
      state.hovering = false;
      place();
    };
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerout", onOut);

    const observer = new IntersectionObserver(
      entries => {
        state.visible = entries.some(entry => entry.isIntersecting);
        if (state.visible) place();
      },
      { rootMargin: "120px" },
    );
    observer.observe(root);

    const resize = new ResizeObserver(() => {
      measure();
      place();
    });
    resize.observe(root);

    return () => {
      state.alive = false;
      gsap.ticker.remove(tick);
      observer.disconnect();
      resize.disconnect();
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerout", onOut);
    };
  }, []);

  const groups = RINGS.map((_, ring) => items.filter((_, i) => i % RINGS.length === ring));

  return (
    <div
      ref={wrap}
      className="relative mx-auto aspect-square w-full max-w-[560px] select-none"
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="orbit-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(167,139,250,0.5)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(103,232,249,0.4)" />
          </linearGradient>
        </defs>
        <g className="orbit-guides">
          {RINGS.map(ring => (
            <ellipse
              key={ring.tilt}
              cx={CENTER}
              cy={CENTER}
              rx={(SIZE / 2) * ring.rx}
              ry={(SIZE / 2) * ring.ry}
              fill="none"
              stroke="url(#orbit-line)"
              strokeWidth={1}
              transform={`rotate(${ring.tilt} ${CENTER} ${CENTER})`}
            />
          ))}
        </g>
        {/* Comet: kepala bercahaya + ekor menipis, mengitari tiap garis orbit. */}
        {RINGS.map(ring => {
          const rxView = (SIZE / 2) * ring.rx;
          const ryView = (SIZE / 2) * ring.ry;
          return (
            <g
              key={`comet-${ring.tilt}`}
              className="orbit-comet"
              data-vel={ring.speed * 1300}
              transform={`rotate(${ring.tilt} ${CENTER} ${CENTER})`}
            >
              <ellipse className="orbit-measure" cx={CENTER} cy={CENTER} rx={rxView} ry={ryView} fill="none" />
              {COMET.map((dot, di) => (
                <circle
                  key={di}
                  className={di === 0 ? "orbit-dot orbit-head" : "orbit-dot"}
                  cx={CENTER + Math.cos(dot.f * Math.PI * 2) * rxView}
                  cy={CENTER + Math.sin(dot.f * Math.PI * 2) * ryView}
                  r={dot.r}
                  opacity={dot.o}
                  fill={di === 0 ? "#ffffff" : "#c7b8ff"}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {RINGS.map((ring, ringIndex) => (
        <div
          key={ring.tilt}
          className="absolute inset-0"
          style={{ transform: `rotate(${ring.tilt}deg)` }}
        >
          {groups[ringIndex].map((item, index) => {
            const count = groups[ringIndex].length;
            return (
              <div
                key={item.name}
                data-ring={ringIndex}
                data-angle={ring.phase + (index / count) * Math.PI * 2}
                className="orbit-node group absolute left-1/2 top-1/2"
              >
                <div
                  className="flex flex-col items-center gap-2"
                  style={{ transform: `translate(-50%, -50%) rotate(${-ring.tilt}deg)` }}
                >
                  <span className="flex size-10 items-center justify-center rounded-2xl border border-white/[0.12] bg-[#0b0c13]/90 p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-300 group-hover:border-violet-300/40 group-hover:shadow-[0_0_24px_-4px_rgba(167,139,250,0.45)] md:size-11">
                    {item.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.logo}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-contain"
                      />
                    ) : (
                      <span className="text-[15px] text-white/70">{item.name.charAt(0)}</span>
                    )}
                  </span>
                  <span className="pointer-events-none whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {item.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="orbit-core pointer-events-none absolute left-1/2 top-1/2 flex size-24 items-center justify-center md:size-28">
        <Image
          src="/image/favicon.png"
          alt="ITZ AI"
          width={224}
          height={224}
          priority={false}
          className="size-full object-contain drop-shadow-[0_0_28px_rgba(139,92,246,0.45)]"
        />
      </div>
    </div>
  );
}