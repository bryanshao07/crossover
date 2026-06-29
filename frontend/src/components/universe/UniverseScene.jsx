import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import PlayerPoints from "./PlayerPoints";

const DEFAULT_TARGET = new THREE.Vector3(0, -2, 0);
const DEFAULT_CAMERA = new THREE.Vector3(9, -2, 15.59);

const CONN_COLORS = ["#ff6b9d", "#4af0c8", "#ffd44f", "#6bb5ff", "#ff9f43"];
const SPORT_PILL_COLORS = { basketball: "#4a7fff", soccer: "#39d353" };
function sportColor(sport) { return SPORT_PILL_COLORS[sport] ?? "#4a7fff"; }

function PlayerTooltip({ player, color }) {
  const sportLabel = player.sport === "basketball" ? "NBA" : "SOC";
  return (
    <div style={{
      position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
      transform: "translateX(-50%)", pointerEvents: "none", zIndex: 99999,
      padding: "7px 10px", background: "rgba(10,10,15,0.95)",
      border: `1px solid ${color}`, backdropFilter: "blur(8px)",
      minWidth: 150, whiteSpace: "nowrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff" }}>
        {player.name}
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700,
          color, border: `1px solid ${color}`, padding: "0 5px",
          background: `${color}1a`,
        }}>
          {sportLabel}
        </span>
      </div>
      {player.dna && (
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#e8ff47", marginTop: 4 }}>
          {player.dna}
        </div>
      )}
    </div>
  );
}

function ConnectionPill({ conn, onMatchClick }) {
  const [hovered, setHovered] = useState(false);
  const color = sportColor(conn.to?.sport);
  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => onMatchClick(conn.name)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontFamily: "JetBrains Mono, monospace", fontSize: "10px", fontWeight: 600,
          color: hovered ? "#0a0a0f" : color,
          whiteSpace: "nowrap", padding: "2px 7px 2px 5px",
          border: `1px solid ${color}88`,
          background: hovered ? color : "rgba(10,10,15,0.82)",
          letterSpacing: "0.03em", userSelect: "none", cursor: "pointer",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: hovered ? "#0a0a0f" : color, flexShrink: 0 }} />
        {conn.name}
      </div>
      {hovered && <PlayerTooltip player={conn.to} color={color} />}
    </div>
  );
}

const ZOOM_DISTANCE = 5;

function CameraRig({ selectedPlayer }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const animTarget = useRef(DEFAULT_TARGET.clone());
  const animCamera = useRef(DEFAULT_CAMERA.clone());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (selectedPlayer) {
      const px = selectedPlayer.x;
      const py = selectedPlayer.y;
      const pz = selectedPlayer.z;
      animTarget.current.set(px, py, pz);
      const dir = new THREE.Vector3()
        .subVectors(
          camera.position,
          controlsRef.current?.target ?? DEFAULT_TARGET,
        )
        .normalize();
      animCamera.current.set(px, py, pz).addScaledVector(dir, ZOOM_DISTANCE);
    } else {
      animTarget.current.copy(DEFAULT_TARGET);
      animCamera.current.copy(DEFAULT_CAMERA);
    }
    isAnimating.current = true;
  }, [selectedPlayer, camera]);

  useFrame(() => {
    if (!controlsRef.current) return;
    if (isAnimating.current) {
      controlsRef.current.target.lerp(animTarget.current, 0.06);
      camera.position.lerp(animCamera.current, 0.06);
      if (
        controlsRef.current.target.distanceTo(animTarget.current) < 0.01 &&
        camera.position.distanceTo(animCamera.current) < 0.01
      ) {
        isAnimating.current = false;
      }
    }
    controlsRef.current.update();
  });

  return <OrbitControls ref={controlsRef} enableDamping target={[0, -2, 0]} />;
}

function EdgeProjector({ selectedPlayer, matchConnections, onEdgeUpdate }) {
  const { camera, size } = useThree();
  const prevKeyRef = useRef("");

  useFrame(() => {
    if (!selectedPlayer || !matchConnections.length) {
      if (prevKeyRef.current !== "") {
        prevKeyRef.current = "";
        onEdgeUpdate([]);
      }
      return;
    }

    const cx = size.width / 2;
    const cy = size.height / 2;
    const margin = 52;

    const results = matchConnections.flatMap((conn) => {
      const ndc = new THREE.Vector3(conn.to.x, conn.to.y, conn.to.z).project(camera);
      const behindCamera = ndc.z > 1;
      const rawX = (ndc.x + 1) / 2 * size.width;
      const rawY = (-ndc.y + 1) / 2 * size.height;

      const onScreen = !behindCamera &&
        rawX >= margin && rawX <= size.width - margin &&
        rawY >= margin && rawY <= size.height - margin;

      if (onScreen) return [];

      // Direction from screen center to projected point; flip if behind camera
      let dx = rawX - cx;
      let dy = rawY - cy;
      if (behindCamera) { dx = -dx; dy = -dy; }

      // Scale direction to touch the margin boundary
      const scale = Math.min(
        (cx - margin) / (Math.abs(dx) || 0.01),
        (cy - margin) / (Math.abs(dy) || 0.01),
        1,
      );

      return [{
        name: conn.name,
        x: cx + dx * scale,
        y: cy + dy * scale,
        sport: conn.to.sport,
        dna: conn.to.dna,
        similarity: conn.similarity,
      }];
    });

    // Only call setState when something actually moved (1px threshold)
    const key = results.map(r => `${r.name}:${Math.round(r.x)}:${Math.round(r.y)}`).join("|");
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      onEdgeUpdate(results);
    }
  });

  return null;
}

function Connections({ selectedPlayer, matchConnections, onMatchClick }) {
  if (!selectedPlayer || !matchConnections.length) return null;
  const from = [selectedPlayer.x, selectedPlayer.y, selectedPlayer.z];

  return (
    <group>
      {matchConnections.map((conn, i) => {
        const lineColor = CONN_COLORS[i % CONN_COLORS.length];
        const to = [conn.to.x, conn.to.y, conn.to.z];
        return (
          <group key={conn.name}>
            <Line points={[from, to]} color={lineColor} lineWidth={1.2} transparent opacity={0.55} />
            <Html position={to} occlude={false} zIndexRange={[9999, 0]}>
              <ConnectionPill conn={conn} onMatchClick={onMatchClick} />
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function UniverseScene({
  points,
  colorBy,
  onHover,
  onSelect,
  selectedPlayer,
  matchConnections,
  onEdgeUpdate,
  onMatchClick,
}) {
  return (
    <Canvas camera={{ position: [9, -2, 15.59], fov: 60 }}>
      <ambientLight />
      <CameraRig selectedPlayer={selectedPlayer} />
      <Connections
        selectedPlayer={selectedPlayer}
        matchConnections={matchConnections ?? []}
        onMatchClick={onMatchClick}
      />
      <EdgeProjector
        selectedPlayer={selectedPlayer}
        matchConnections={matchConnections ?? []}
        onEdgeUpdate={onEdgeUpdate}
      />
      <PlayerPoints
        points={points}
        colorBy={colorBy}
        onHover={onHover}
        onSelect={onSelect}
        selectedPlayerName={selectedPlayer?.name}
      />
    </Canvas>
  );
}
