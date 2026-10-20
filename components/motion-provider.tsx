"use client";

import { LazyMotion } from "framer-motion";
import { loadFeatures } from "@/lib/motion-features";

/**
 * Client-side wrapper around LazyMotion so server components can pass children
 * through without any framer-motion code on the SSR path.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict={false}>
      {children}
    </LazyMotion>
  );
}
