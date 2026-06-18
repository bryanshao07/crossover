import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";

function Points() {
  const ref = useRef();
  const positions = useMemo(() => {
    const n = 1200;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) arr[i] = (Math.sin(i * 7.13) * 0.5 + (i % 50) / 50 - 0.5) * 18;
    return arr;
  }, []);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03; });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#e8ff47" transparent opacity={0.5} />
    </points>
  );
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 22], fov: 60 }}>
        <Points />
      </Canvas>
    </div>
  );
}
