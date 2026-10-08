"use client";

import OrbitalSphereBackground from "@/components/ui/orbital-sphere";

export default function OrbitalSphereDemo() {
  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-xl bg-[#05030a]">
      <OrbitalSphereBackground className="absolute inset-0" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-xs uppercase tracking-[0.2em] text-violet-300/70">
          Three.js · Structure Flow
        </span>
        <h2 className="max-w-md text-3xl font-semibold text-white">
          Orbital Sphere
        </h2>
        <p className="max-w-sm text-sm text-white/60">
          A violet particle synthesis sphere with encrypted orbital rings and
          luminous data nodes.
        </p>
      </div>
    </div>
  );
}
