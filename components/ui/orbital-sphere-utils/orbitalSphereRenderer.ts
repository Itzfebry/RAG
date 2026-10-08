import * as THREE from "three";

export interface OrbitalSphereOptions {
  hue: number;
  particleCount: number;
  particleSize: number;
  orbitRadius: number;
  ringCount: number;
  rotationSpeed: number;
  glowIntensity: number;
  cameraDistance: number;
  nodeCount: number;
  nodeSize: number;
  nodeGlow: number;
}

export const ORBITAL_SPHERE_DEFAULTS: OrbitalSphereOptions = {
  hue: 0,
  particleCount: 2000,
  particleSize: 2,
  orbitRadius: 3,
  ringCount: 3,
  rotationSpeed: 0.1,
  glowIntensity: 1.5,
  cameraDistance: 8,
  nodeCount: 12,
  nodeSize: 6,
  nodeGlow: 2,
};

export interface OrbitalSphereRenderer {
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
}

export function createOrbitalSphereRenderer(
  canvas: HTMLCanvasElement,
  getOptions: () => OrbitalSphereOptions
): OrbitalSphereRenderer | null {
  let renderer: THREE.WebGLRenderer;
  
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: false,
    });
  } catch (error) {
    console.warn("WebGL not available, orbital sphere disabled:", error);
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

  // Particle sphere
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(
    ORBITAL_SPHERE_DEFAULTS.particleCount * 3
  );

  for (let i = 0; i < ORBITAL_SPHERE_DEFAULTS.particleCount; i++) {
    const i3 = i * 3;
    const radius = ORBITAL_SPHERE_DEFAULTS.orbitRadius;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    particlePositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    particlePositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    particlePositions[i3 + 2] = radius * Math.cos(phi);
  }

  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(particlePositions, 3)
  );

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x8b5cf6,
    size: ORBITAL_SPHERE_DEFAULTS.particleSize / 100,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // Orbital rings
  const rings: THREE.LineLoop[] = [];
  for (let i = 0; i < ORBITAL_SPHERE_DEFAULTS.ringCount; i++) {
    const ringGeometry = new THREE.BufferGeometry();
    const ringPoints: THREE.Vector3[] = [];
    const segments = 64;
    const angle = (i * Math.PI) / ORBITAL_SPHERE_DEFAULTS.ringCount;

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const x =
        ORBITAL_SPHERE_DEFAULTS.orbitRadius * Math.cos(theta) * Math.sin(angle);
      const y =
        ORBITAL_SPHERE_DEFAULTS.orbitRadius * Math.sin(theta) * Math.sin(angle);
      const z = ORBITAL_SPHERE_DEFAULTS.orbitRadius * Math.cos(angle);
      ringPoints.push(new THREE.Vector3(x, y, z));
    }

    ringGeometry.setFromPoints(ringPoints);
    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.3,
    });

    const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
    rings.push(ring);
    scene.add(ring);
  }

  // Luminous nodes
  const nodes: THREE.Mesh[] = [];
  for (let i = 0; i < ORBITAL_SPHERE_DEFAULTS.nodeCount; i++) {
    const nodeGeometry = new THREE.SphereGeometry(
      ORBITAL_SPHERE_DEFAULTS.nodeSize / 100,
      16,
      16
    );
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.8,
    });

    const node = new THREE.Mesh(nodeGeometry, nodeMaterial);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = ORBITAL_SPHERE_DEFAULTS.orbitRadius;

    node.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );

    nodes.push(node);
    scene.add(node);
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x8b5cf6, 2, 50);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);

  let time = 0;

  return {
    resize(width: number, height: number): void {
      const options = getOptions();
      camera.aspect = width / height;
      camera.position.z = options.cameraDistance;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },

    render(): void {
      const options = getOptions();
      time += options.rotationSpeed * 0.01;

      // Rotate particles
      particles.rotation.y = time;
      particles.rotation.x = time * 0.5;

      // Rotate rings
      rings.forEach((ring, i) => {
        ring.rotation.y = time * (1 + i * 0.2);
        ring.rotation.x = time * 0.3;
      });

      // Animate nodes
      nodes.forEach((node, i) => {
        const offset = (i / nodes.length) * Math.PI * 2;
        node.position.y += Math.sin(time * 2 + offset) * 0.01;
        
        const material = node.material as THREE.MeshBasicMaterial;
        material.opacity = 0.6 + Math.sin(time * 3 + offset) * 0.2;
      });

      renderer.render(scene, camera);
    },

    dispose(): void {
      particleGeometry.dispose();
      particleMaterial.dispose();
      rings.forEach((ring) => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });
      nodes.forEach((node) => {
        node.geometry.dispose();
        (node.material as THREE.Material).dispose();
      });
      renderer.dispose();
    },
  };
}
