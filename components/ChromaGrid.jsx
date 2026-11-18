'use client';

import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef } from 'react';

const THEMES = {
  dark: {
    '--chroma-frame': 'rgba(38, 35, 46, 0.66)',
    '--chroma-frame-edge': 'rgba(255, 255, 255, 0.08)',
    '--chroma-frame-highlight': 'rgba(255, 255, 255, 0.07)',
    '--chroma-frame-shadow': '0 22px 44px -20px rgba(0, 0, 0, 0.8), 0 6px 16px -8px rgba(0, 0, 0, 0.5)',
    '--chroma-tile': 'linear-gradient(180deg, #0d0e13 0%, #08090d 100%)',
    '--chroma-tile-edge': 'rgba(255, 255, 255, 0.08)',
    '--chroma-tile-highlight': 'rgba(255, 255, 255, 0.07)',
    '--chroma-tile-shadow': '0 4px 14px -6px rgba(0, 0, 0, 0.8)',
    '--chroma-media-edge': 'rgba(255, 255, 255, 0.06)',
    '--chroma-well': 'rgba(255, 255, 255, 0.08)',
    '--chroma-ink': '#f4f4f5',
    '--chroma-muted': 'rgba(244, 244, 245, 0.55)',
    '--chroma-hover': 'brightness(1.12)',
    '--chroma-press': 'brightness(0.85)'
  },
  light: {
    '--chroma-frame': 'rgba(240, 240, 243, 0.8)',
    '--chroma-frame-edge': 'rgba(24, 24, 27, 0.07)',
    '--chroma-frame-highlight': 'rgba(255, 255, 255, 0.95)',
    '--chroma-frame-shadow': '0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)',
    '--chroma-tile': 'linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)',
    '--chroma-tile-edge': 'rgba(24, 24, 27, 0.08)',
    '--chroma-tile-highlight': 'rgba(255, 255, 255, 1)',
    '--chroma-tile-shadow': '0 4px 10px -5px rgba(24, 24, 27, 0.25)',
    '--chroma-media-edge': 'rgba(24, 24, 27, 0.06)',
    '--chroma-well': 'rgba(24, 24, 27, 0.05)',
    '--chroma-ink': '#27272a',
    '--chroma-muted': 'rgba(39, 39, 42, 0.55)',
    '--chroma-hover': 'brightness(0.97)',
    '--chroma-press': 'brightness(0.92)'
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** @typedef {{ image: string, title?: string, subtitle?: string, accent?: string, alt?: string, url?: string }} ChromaItem */

const falloffStops = softness => {
  const core = clamp(1 - softness, 0, 0.95);
  const stops = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const u = clamp((t - core) / Math.max(0.0001, 1 - core), 0, 1);
    const alpha = 1 - u * u * u * (u * (u * 6 - 15) + 10);
    stops.push(`rgba(0, 0, 0, ${alpha.toFixed(3)}) ${(t * 100).toFixed(1)}%`);
  }
  return stops.join(', ');
};

const STYLE = `
.chroma-grid {
  --chroma-x: -9999px;
  --chroma-y: -9999px;
  --chroma-power: 0;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.chroma-grid.has-frame {
  padding: 10px;
  border-radius: calc(var(--chroma-radius) + 10px);
  background: var(--chroma-frame);
  box-shadow: var(--chroma-frame-shadow);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  backdrop-filter: blur(20px) saturate(1.6);
}

.chroma-frame-rim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px var(--chroma-frame-edge),
    inset 0 1px 0 var(--chroma-frame-highlight);
  pointer-events: none;
}

@keyframes chroma-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  33% {
    transform: translate3d(0, -8px, 0) rotate(-0.25deg);
  }
  66% {
    transform: translate3d(0, 6px, 0) rotate(0.25deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chroma-card {
    animation: none !important;
  }
}

.chroma-grid-inner {
  display: grid;
  gap: var(--chroma-gap);
  grid-template-columns: repeat(
    auto-fill,
    minmax(
      min(
        100%,
        max(var(--chroma-min), calc((100% - (var(--chroma-cols) - 1) * var(--chroma-gap)) / var(--chroma-cols)))
      ),
      1fr
    )
  );
}

.chroma-card {
  animation: chroma-drift var(--chroma-drift, 9s) ease-in-out infinite;
  animation-delay: calc(var(--chroma-i, 0) * -1.7s);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 8px;
  box-sizing: border-box;
  border-radius: var(--chroma-radius);
  background: var(--chroma-tile);
  box-shadow: var(--chroma-tile-shadow);
  color: var(--chroma-ink);
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  transition: filter 0.25s ease;
}

.chroma-card:hover {
  filter: var(--chroma-hover);
}

a.chroma-card:active {
  filter: var(--chroma-press);
}

a.chroma-card:focus-visible {
  outline: 2px solid var(--chroma-ink);
  outline-offset: 2px;
}

.chroma-wash,
.chroma-color,
.chroma-card-glow {
  -webkit-mask-image: radial-gradient(
    circle var(--chroma-r) at calc(var(--chroma-x) - var(--chroma-ox, 0px))
      calc(var(--chroma-y) - var(--chroma-oy, 0px)),
    var(--chroma-stops)
  );
  mask-image: radial-gradient(
    circle var(--chroma-r) at calc(var(--chroma-x) - var(--chroma-ox, 0px))
      calc(var(--chroma-y) - var(--chroma-oy, 0px)),
    var(--chroma-stops)
  );
}

.chroma-wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(130% 70% at 50% 100%, var(--chroma-accent), transparent 72%);
  opacity: calc(var(--chroma-glow) * var(--chroma-power) * 0.45);
}

.chroma-media {
  position: relative;
  z-index: 1;
  aspect-ratio: var(--chroma-ratio);
  border-radius: max(0px, calc(var(--chroma-radius) - 8px));
  overflow: hidden;
  background: var(--chroma-well);
}

.chroma-media img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  -webkit-user-drag: none;
}

.chroma-mono {
  filter: grayscale(var(--chroma-gray)) brightness(calc(1 - var(--chroma-dim)));
}

.chroma-color {
  opacity: var(--chroma-power);
}

.chroma-media-rim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--chroma-media-edge);
  pointer-events: none;
}

.chroma-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 0 6px 6px;
}

.chroma-title {
  overflow: hidden;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.28;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chroma-subtitle {
  font-size: 14px;
  line-height: 1.6;
  color: var(--chroma-muted);
}

.chroma-card-rim,
.chroma-card-glow {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  pointer-events: none;
}

.chroma-card-rim {
  box-shadow:
    inset 0 0 0 1px var(--chroma-tile-edge),
    inset 0 1px 0 var(--chroma-tile-highlight);
}

.chroma-card-glow {
  box-shadow:
    inset 0 0 0 1px var(--chroma-accent),
    inset 0 0 16px -8px var(--chroma-accent);
  opacity: calc(var(--chroma-border) * var(--chroma-power));
}

.chroma-grid[data-reveal='card'] .chroma-wash,
.chroma-grid[data-reveal='card'] .chroma-color,
.chroma-grid[data-reveal='card'] .chroma-card-glow {
  -webkit-mask-image: none;
  mask-image: none;
  opacity: 0;
  transition: opacity var(--chroma-fade) ease;
}

.chroma-grid[data-reveal='card'] .chroma-card:hover .chroma-wash {
  opacity: calc(var(--chroma-glow) * 0.45);
  transition-duration: 0.3s;
}

.chroma-grid[data-reveal='card'] .chroma-card:hover .chroma-color {
  opacity: 1;
  transition-duration: 0.3s;
}

.chroma-grid[data-reveal='card'] .chroma-card:hover .chroma-card-glow {
  opacity: var(--chroma-border);
  transition-duration: 0.3s;
}`;

export const ChromaGrid = ({
  /** @type {ChromaItem[]} */
  items = /** @type {ChromaItem[]} */ ([]),
  columns = 3,
  minCardWidth = 260,
  gap = 12,
  radius = 260,
  softness = 0.6,
  damping = 0.45,
  fadeOut = 0.6,
  grayscale = 1,
  dim = 0.12,
  glow = 0.5,
  borderGlow = 1,
  reveal = 'spotlight',
  aspectRatio = '3 / 2',
  cardRadius = 22,
  showInfo = true,
  frame = false,
  theme = 'dark',
  className = ''
}) => {
  const rootRef = useRef(null);
  const settingsRef = useRef(null);
  const placeRef = useRef(null);
  settingsRef.current = { damping, fadeOut, spotlight: reveal !== 'card' };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const state = { x: 0, y: 0, tx: 0, ty: 0, power: 0, target: 0, primed: false };
    let raf = 0;
    let last = 0;

    const place = () => {
      const box = root.getBoundingClientRect();
      root.querySelectorAll('[data-chroma-area]').forEach(node => {
        const rect = node.getBoundingClientRect();
        node.style.setProperty('--chroma-ox', `${rect.left - box.left}px`);
        node.style.setProperty('--chroma-oy', `${rect.top - box.top}px`);
      });
    };
    placeRef.current = place;

    const frameLoop = now => {
      raf = 0;
      const s = settingsRef.current;
      if (!s) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const follow = reduce ? 1 : 1 - Math.exp(-dt / Math.max(0.01, s.damping * 0.32));
      state.x += (state.tx - state.x) * follow;
      state.y += (state.ty - state.y) * follow;
      const span = state.target > state.power ? 0.1 : Math.max(0.02, s.fadeOut * 0.35);
      state.power += (state.target - state.power) * (reduce ? 1 : 1 - Math.exp(-dt / span));
      root.style.setProperty('--chroma-x', `${state.x.toFixed(2)}px`);
      root.style.setProperty('--chroma-y', `${state.y.toFixed(2)}px`);
      root.style.setProperty('--chroma-power', state.power.toFixed(4));
      const settled =
        Math.abs(state.tx - state.x) < 0.1 &&
        Math.abs(state.ty - state.y) < 0.1 &&
        Math.abs(state.target - state.power) < 0.002;
      if (settled) {
        state.power = state.target;
        root.style.setProperty('--chroma-power', state.power.toFixed(4));
        last = 0;
      } else {
        raf = requestAnimationFrame(frameLoop);
      }
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frameLoop);
    };

    const onMove = event => {
      if (!settingsRef.current?.spotlight) return;
      const box = root.getBoundingClientRect();
      state.tx = event.clientX - box.left;
      state.ty = event.clientY - box.top;
      if (!state.primed || state.power < 0.02) {
        state.x = state.tx;
        state.y = state.ty;
        state.primed = true;
      }
      state.target = 1;
      wake();
    };

    const onLeave = () => {
      state.target = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(place);
    resizeObserver.observe(root);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerdown', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointercancel', onLeave);
    place();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointercancel', onLeave);
      placeRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    placeRef.current?.();
  });

  const rootStyle = {
    ...(THEMES[theme] ?? THEMES.dark),
    '--chroma-cols': Math.max(1, Math.round(columns)),
    '--chroma-min': `${Math.max(80, minCardWidth)}px`,
    '--chroma-gap': `${Math.max(0, gap)}px`,
    '--chroma-r': `${Math.max(20, radius)}px`,
    '--chroma-stops': falloffStops(clamp(softness, 0, 1)),
    '--chroma-gray': clamp(grayscale, 0, 1),
    '--chroma-dim': clamp(dim, 0, 0.9),
    '--chroma-glow': clamp(glow, 0, 1),
    '--chroma-border': clamp(borderGlow, 0, 1),
    '--chroma-fade': `${Math.max(0, fadeOut)}s`,
    '--chroma-ratio': aspectRatio,
    '--chroma-radius': `${Math.max(0, cardRadius)}px`
  };

  return (
    <div
      ref={rootRef}
      className={`chroma-grid${frame ? ' has-frame' : ''}${className ? ` ${className}` : ''}`}
      data-reveal={reveal === 'card' ? 'card' : 'spotlight'}
      style={rootStyle}
    >
      <style>{STYLE}</style>
      <div className="chroma-grid-inner">
        {items.map((item, index) => {
          const accent = item.accent ?? '#ffffff';
          const cardStyle = { '--chroma-accent': accent, '--chroma-i': String(index) };
          const body = (
            <>
              <span className="chroma-wash" aria-hidden="true" />
              <div className="chroma-media" data-chroma-area="">
                <Image
                  className="chroma-mono"
                  src={item.image}
                  alt={item.alt ?? item.title ?? ''}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                />
                <Image
                  className="chroma-color"
                  src={item.image}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                />
                <span className="chroma-media-rim" aria-hidden="true" />
              </div>
              {showInfo && (item.title || item.subtitle) && (
                <div className="chroma-info">
                  {item.title && <span className="chroma-title">{item.title}</span>}
                  {item.subtitle && <span className="chroma-subtitle">{item.subtitle}</span>}
                </div>
              )}
              <span className="chroma-card-rim" aria-hidden="true" />
              <span className="chroma-card-glow" aria-hidden="true" />
            </>
          );
          return item.url ? (
            <a
              key={`${item.title}-${index}`}
              className="chroma-card"
              data-chroma-area=""
              style={cardStyle}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {body}
            </a>
          ) : (
            <article key={`${item.title}-${index}`} className="chroma-card" data-chroma-area="" style={cardStyle}>
              {body}
            </article>
          );
        })}
      </div>
      {frame && <span className="chroma-frame-rim" aria-hidden="true" />}
    </div>
  );
};

export default ChromaGrid;