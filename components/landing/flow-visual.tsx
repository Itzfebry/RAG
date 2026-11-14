"use client";

// Medan alir 3D untuk hero: permukaan gelombang yang mengalir (shader sendiri),
// tanpa tekstur/pustaka tambahan. Menggantikan pita iridescent.
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const VERT = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uTime;
    float h = sin(p.x * 1.5 + t) * 0.30
            + sin(p.y * 2.3 - t * 0.85) * 0.22
            + sin((p.x + p.y) * 1.1 + t * 1.25) * 0.16;
    p.z += h;
    vHeight = h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  void main() {
    float hue = fract(vUv.x * 0.85 + vHeight * 0.4 + uTime * 0.015);
    vec3 col = hsv2rgb(vec3(hue, 0.52, 0.95));
    float band = smoothstep(0.42, 0.04, abs(vUv.y - 0.5));
    float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    float crest = smoothstep(-0.2, 0.42, vHeight);
    float alpha = band * edge * (0.3 + crest * 0.7);
    gl_FragColor = vec4(col * (0.6 + crest * 0.85), alpha * 0.7);
  }
`;

// Satu kanvas per halaman: uniform waktu disimpan di level modul supaya tidak
// dimutasi dari nilai hasil hook (aturan react-compiler).
const UNIFORMS = { uTime: { value: 0 } };

function FlowField({ reducedMotion }: { reducedMotion: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (reducedMotion) return;
    UNIFORMS.uTime.value = state.clock.elapsedTime;
    if (mesh.current) mesh.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.08;
  });

  return (
    <mesh ref={mesh} rotation={[-0.42, 0, 0]}>
      <planeGeometry args={[7, 3.6, 160, 90]} />
      <shaderMaterial
        uniforms={UNIFORMS}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function FlowVisual({ className }: { className?: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Performa: berhenti menggambar saat keluar layar.
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "120px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 4.6], fov: 44 }}
        dpr={[1, 1.25]}
        frameloop={visible && !reducedMotion ? "always" : "demand"}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      >
        <FlowField reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
