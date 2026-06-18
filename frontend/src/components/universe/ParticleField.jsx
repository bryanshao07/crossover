import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";

// deterministic pseudo-random so the galaxy is stable across renders
function rand(i, seed) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// flattened spiral-galaxy disc of points
function galaxy(n, seed) {
  const arr = new Float32Array(n * 3);
  const arms = 4;
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rand(i, seed), 0.6); // mild bias toward center
    const radius = t * 30 + 1.5;
    const arm = (i % arms) * ((Math.PI * 2) / arms);
    const angle = t * 5 + arm;
    const spread = (1 - t) * 3.5 + 1.2;
    const jx = (rand(i, seed + 1) - 0.5) * spread;
    const jy = (rand(i, seed + 2) - 0.5) * (3 + t * 2.5);
    const jz = (rand(i, seed + 3) - 0.5) * spread;
    arr[i * 3] = Math.cos(angle) * radius + jx;
    arr[i * 3 + 1] = jy;
    arr[i * 3 + 2] = Math.sin(angle) * radius + jz;
  }
  return arr;
}

// individual meshes sharing one geometry + material — the same pattern the
// universe uses, which renders reliably across GPUs and software renderers.
function Cloud({ count, color, seed, size }) {
  const positions = useMemo(() => galaxy(count, seed), [count, seed]);
  const geometry = useMemo(() => new THREE.SphereGeometry(size, 6, 6), [size]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color]
  );
  const items = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]);
    }
    return out;
  }, [count, positions]);

  return (
    <group>
      {items.map((p, i) => (
        <mesh key={i} geometry={geometry} material={material} position={p} />
      ))}
    </group>
  );
}

function Galaxy() {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.025;
  });
  return (
    <group ref={ref} rotation={[0.42, 0, 0.12]}>
      <Cloud count={520} color="#4a7fff" seed={3} size={0.11} />
      <Cloud count={560} color="#39d353" seed={11} size={0.11} />
    </group>
  );
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 blur-[1px]">
        <Canvas camera={{ position: [0, 4, 26], fov: 60 }}>
          <Galaxy />
        </Canvas>
      </div>
      {/* dim + vignette so foreground UI stays readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10,10,15,0.55) 0%, rgba(10,10,15,0.25) 38%, rgba(10,10,15,0.78) 100%)",
        }}
      />
    </div>
  );
}
