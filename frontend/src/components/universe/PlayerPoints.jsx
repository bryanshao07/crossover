import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.55);
  gradient.addColorStop(0, "rgba(255,255,255,1.0)");
  gradient.addColorStop(0.4, "rgba(255,255,255,1.0)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createSolidTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  ctx.beginPath();
  ctx.arc(cx, cx, cx * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

const HIGHLIGHTED_PLAYERS = [];

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function isHighlighted(name) {
  const n = normalize(name);
  return HIGHLIGHTED_PLAYERS.some((h) => n.includes(h));
}


const SPORT_COLORS = {
  basketball: new THREE.Color("#4488ff"),
  soccer: new THREE.Color("#44ff88"),
  accent: new THREE.Color("#e8ff47"),
};

// Maps quality (~0.7–1.1) to a scale range of 0.18–0.34
function qualityToScale(quality) {
  const q = quality ?? 0.85;
  const t = Math.max(0, Math.min(1, (q - 0.7) / 0.4));
  return 0.30 + t * 0.22;
}

function GlowPoint({ player, colorBy, glowTexture, solidTexture, onHover, onSelect, isSelected }) {
  const spriteRef = useRef();
  const solidRef = useRef();
  const hoveredRef = useRef(false);
  const baseScale = useMemo(() => qualityToScale(player.quality), [player.quality]);
  const color = colorBy === "accent"
    ? SPORT_COLORS.accent
    : (SPORT_COLORS[player.sport] ?? SPORT_COLORS.basketball);

  useFrame((state) => {
    if (!spriteRef.current) return;
    if (isSelected) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.12;
      const s = baseScale * 3.2 * pulse;
      spriteRef.current.scale.set(s, s, s);
      if (solidRef.current) solidRef.current.scale.set(baseScale * 1.1, baseScale * 1.1, baseScale * 1.1);
    } else if (hoveredRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.15;
      const s = baseScale * 1.8 * pulse;
      spriteRef.current.scale.set(s, s, s);
    } else {
      spriteRef.current.scale.set(baseScale, baseScale, baseScale);
    }
  });

  return (
    <>
      <sprite
        ref={spriteRef}
        position={[player.x, player.y, player.z]}
        scale={[baseScale, baseScale, baseScale]}
        onPointerOver={(e) => { e.stopPropagation(); hoveredRef.current = true; onHover(player, e); }}
        onPointerOut={(e) => { e.stopPropagation(); hoveredRef.current = false; onHover(null); }}
        onClick={(e) => { e.stopPropagation(); onSelect(player); }}
      >
        <spriteMaterial
          map={glowTexture}
          color={color}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </sprite>
      {isSelected && (
        <sprite
          ref={solidRef}
          position={[player.x, player.y, player.z]}
          scale={[baseScale * 1.1, baseScale * 1.1, baseScale * 1.1]}
        >
          <spriteMaterial
            map={solidTexture}
            color={color}
            blending={THREE.NormalBlending}
            transparent={false}
            depthWrite={false}
          />
        </sprite>
      )}
    </>
  );
}

function HighlightedPoint({ player, colorBy, glowTexture, solidTexture, onHover, onSelect, isSelected }) {
  const dotScale = useMemo(() => qualityToScale(player.quality), [player.quality]);
  const [labelHovered, setLabelHovered] = useState(false);

  return (
    <group position={[player.x, player.y, player.z]}>
      <GlowPoint
        player={{ ...player, x: 0, y: 0, z: 0 }}
        colorBy={colorBy}
        glowTexture={glowTexture}
        solidTexture={solidTexture}
        onHover={onHover}
        onSelect={onSelect}
        isSelected={isSelected}
      />
      <Html
        position={[dotScale * 0.8, dotScale * 0.4, 0]}
        occlude={false}
        zIndexRange={[40, 0]}
      >
        <div
          onClick={() => onSelect(player.name)}
          onMouseEnter={() => setLabelHovered(true)}
          onMouseLeave={() => setLabelHovered(false)}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "10px",
            fontWeight: 600,
            color: labelHovered ? "#0a0a0f" : "#e8ff47",
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
            padding: "2px 6px",
            border: "1px solid rgba(232,255,71,0.55)",
            background: labelHovered ? "#e8ff47" : "rgba(10,10,15,0.75)",
            cursor: "pointer",
            userSelect: "none",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {player.name}
        </div>
      </Html>
    </group>
  );
}

export default function PlayerPoints({ points, colorBy, onHover, onSelect, selectedPlayerName, mode = "active" }) {
  const glowTexture = useMemo(() => createGlowTexture(), []);
  const solidTexture = useMemo(() => createSolidTexture(), []);

  return (
    <group>
      {points.map((p) =>
        mode === "active" && isHighlighted(p.name) ? (
          <HighlightedPoint
            key={p.name}
            player={p}
            colorBy={colorBy}
            glowTexture={glowTexture}
            solidTexture={solidTexture}
            onHover={onHover}
            onSelect={onSelect}
            isSelected={p.name === selectedPlayerName}
          />
        ) : (
          <GlowPoint
            key={p.name}
            player={p}
            colorBy={colorBy}
            glowTexture={glowTexture}
            solidTexture={solidTexture}
            onHover={onHover}
            onSelect={onSelect}
            isSelected={p.name === selectedPlayerName}
          />
        )
      )}
    </group>
  );
}
