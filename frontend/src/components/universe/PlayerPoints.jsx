import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.40, "rgba(255,255,255,0.40)");
  gradient.addColorStop(0.65, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const SPORT_COLORS = {
  basketball: new THREE.Color("#4488ff"),
  soccer: new THREE.Color("#44ff88"),
  accent: new THREE.Color("#e8ff47"),
};

// Maps quality (~0.7–1.1) to a scale range of 0.11–0.22
function qualityToScale(quality) {
  const q = quality ?? 0.85;
  const t = Math.max(0, Math.min(1, (q - 0.7) / 0.4));
  return 0.11 + t * 0.11;
}

function GlowPoint({ player, colorBy, glowTexture, onHover, onSelect }) {
  const spriteRef = useRef();
  const hoveredRef = useRef(false);
  const baseScale = useMemo(() => qualityToScale(player.quality), [player.quality]);
  const color = colorBy === "accent"
    ? SPORT_COLORS.accent
    : (SPORT_COLORS[player.sport] ?? SPORT_COLORS.basketball);

  useFrame((state) => {
    if (!spriteRef.current) return;
    if (hoveredRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.15;
      const s = baseScale * 1.8 * pulse;
      spriteRef.current.scale.set(s, s, s);
    } else {
      const s = baseScale;
      spriteRef.current.scale.set(s, s, s);
    }
  });

  return (
    <sprite
      ref={spriteRef}
      position={[player.x, player.y, player.z]}
      scale={[baseScale, baseScale, baseScale]}
      onPointerOver={(e) => { e.stopPropagation(); hoveredRef.current = true; onHover(player, e); }}
      onPointerOut={(e) => { e.stopPropagation(); hoveredRef.current = false; onHover(null); }}
      onClick={(e) => { e.stopPropagation(); onSelect(player.name); }}
    >
      <spriteMaterial
        map={glowTexture}
        color={color}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </sprite>
  );
}

export default function PlayerPoints({ points, colorBy, onHover, onSelect }) {
  const glowTexture = useMemo(() => createGlowTexture(), []);

  return (
    <group>
      {points.map((p) => (
        <GlowPoint
          key={p.name}
          player={p}
          colorBy={colorBy}
          glowTexture={glowTexture}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
