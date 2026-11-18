"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Lenis smooth scroll, disinkronkan dengan GSAP ScrollTrigger.
 * Dinonaktifkan saat prefers-reduced-motion: reduce.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    // Mode `lerp` (bukan `duration`): posisi mengejar target dengan damping
    // berbasis deltaTime, jadi kecepatan terasa sama di 30/60/144 fps.
    // `duration` membuat tiap tick wheel memutar ulang animasi 1,2 s — saat
    // frame drop, gerakan datang dalam sedikit lompatan besar dan ekornya
    // terasa lama.
    const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.85 });

    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Anchor nav (#id) lewat Lenis, bukan lompatan native.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest?.('a[href^="#"]');
      if (!anchor) return;
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target as HTMLElement, { duration: 1.1 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
