import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html, GizmoHelper } from "@react-three/drei";
import PlayerPoints from "./PlayerPoints";
import PerfHUD from "./PerfHUD";

// Dev-only perf overlay, opt-in per page load via /universe?perf=1. The DEV
// check is compile-time, so the HUD and its useFrame subscription are absent
// from production builds entirely.
const PERF_ENABLED =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("perf");

const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const DEFAULT_CAMERA = new THREE.Vector3(8.1, 7, 14.0);

// Background (homepage) mode
const BG_TARGET = new THREE.Vector3(0, 0, 0);
const BG_CAMERA = new THREE.Vector3(9, 8, 15.59);

const CONN_COLORS = ["#ff6b9d", "#4af0c8", "#ffd44f", "#6bb5ff", "#ff9f43"];
const SPORT_PILL_COLORS = { basketball: "#4a7fff", soccer: "#39d353" };
function sportColor(sport) {
  return SPORT_PILL_COLORS[sport] ?? "#4a7fff";
}

function PlayerTooltip({ player, color }) {
  const sportLabel = player.sport === "basketball" ? "NBA" : "SOC";
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 99999,
        padding: "7px 10px",
        background: "rgba(10,10,15,0.95)",
        border: `1px solid ${color}`,
        backdropFilter: "blur(8px)",
        minWidth: 150,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
        }}
      >
        {player.name}
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            fontWeight: 700,
            color,
            border: `1px solid ${color}`,
            padding: "0 5px",
            background: `${color}1a`,
          }}
        >
          {sportLabel}
        </span>
      </div>
      {player.dna && (
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            color: "#e8ff47",
            marginTop: 4,
          }}
        >
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
          display: "flex",
          alignItems: "center",
          gap: "5px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px",
          fontWeight: 600,
          color: hovered ? "#0a0a0f" : color,
          whiteSpace: "nowrap",
          padding: "2px 7px 2px 5px",
          border: `1px solid ${color}88`,
          background: hovered ? color : "rgba(10,10,15,0.82)",
          letterSpacing: "0.03em",
          userSelect: "none",
          cursor: "pointer",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: hovered ? "#0a0a0f" : color,
            flexShrink: 0,
          }}
        />
        {conn.name}
      </div>
      {hovered && <PlayerTooltip player={conn.to} color={color} />}
    </div>
  );
}

function BlenderGizmo({ hovered }) {
  const SPHERE_R = 8;
  const CUBE = 26;
  const ARM_END = 42;

  const axes = [
    {
      end: [0, 0, ARM_END],
      color: hovered ? "#b03030" : "#7a2020",
      lineColor: hovered ? "#7a2525" : "#3d1010",
      label: "Y",
    },
    {
      end: [0, ARM_END, 0],
      color: hovered ? "#309030" : "#206620",
      lineColor: hovered ? "#1e6e1e" : "#103310",
      label: "Z",
    },
    {
      end: [ARM_END, 0, 0],
      color: hovered ? "#3060c0" : "#203d80",
      lineColor: hovered ? "#1e3d80" : "#101e40",
      label: "X",
    },
  ];

  const h = CUBE / 2;
  const boxEdges = [
    [-h, -h, -h],
    [h, -h, -h],
    [h, -h, -h],
    [h, -h, h],
    [h, -h, h],
    [-h, -h, h],
    [-h, -h, h],
    [-h, -h, -h],
    [-h, h, -h],
    [h, h, -h],
    [h, h, -h],
    [h, h, h],
    [h, h, h],
    [-h, h, h],
    [-h, h, h],
    [-h, h, -h],
    [-h, -h, -h],
    [-h, h, -h],
    [h, -h, -h],
    [h, h, -h],
    [h, -h, h],
    [h, h, h],
    [-h, -h, h],
    [-h, h, h],
  ];

  return (
    <group>
      <Line
        points={boxEdges}
        color="#ffffff"
        transparent
        opacity={hovered ? 0.4 : 0.25}
        lineWidth={hovered ? 4 : 1}
        segments
      />
      {axes.map(({ end, color, lineColor, label }) => (
        <group key={label}>
          <Line
            points={[[0, 0, 0], end]}
            color={lineColor}
            lineWidth={hovered ? 3 : 0.8}
          />
          <mesh position={end}>
            <sphereGeometry args={[SPHERE_R, 16, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Html
            position={end}
            center
            zIndexRange={[99, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#fff",
                  userSelect: "none",
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function GizmoHoverDisc({ onHoverChange }) {
  const set = (v) => onHoverChange(v);
  return (
    <group>
      <mesh onPointerEnter={() => set(true)} onPointerLeave={() => set(false)}>
        <circleGeometry args={[55, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GizmoOverlay() {
  const [hovered, setHovered] = useState(false);
  return (
    <>
      <GizmoHoverDisc onHoverChange={setHovered} />
      <BlenderGizmo hovered={hovered} />
    </>
  );
}

const ZOOM_DISTANCE = 5;

function CameraRig({ selectedPlayer, resetZoomRef, mode }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const animTarget = useRef(BG_TARGET.clone());
  const animCamera = useRef(BG_CAMERA.clone());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (resetZoomRef) {
      resetZoomRef.current = () => {
        animTarget.current.copy(DEFAULT_TARGET);
        animCamera.current.copy(DEFAULT_CAMERA);
        isAnimating.current = true;
      };
    }
  }, [resetZoomRef]);

  // Animate camera when mode changes
  useEffect(() => {
    if (mode === "background") {
      animTarget.current.copy(BG_TARGET);
      animCamera.current.copy(BG_CAMERA);
      isAnimating.current = true;
    } else {
      // Only reset to default if no player is focused
      if (!selectedPlayer) {
        animTarget.current.copy(DEFAULT_TARGET);
        animCamera.current.copy(DEFAULT_CAMERA);
        isAnimating.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Zoom to selected player (active mode only)
  useEffect(() => {
    if (mode !== "active") return;
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
  }, [selectedPlayer, camera, mode]);

  useFrame(() => {
    if (!controlsRef.current) return;
    // Slowly rotate in background mode; pause during lerp so they don't fight
    controlsRef.current.autoRotate = mode === "background" && !isAnimating.current;
    controlsRef.current.autoRotateSpeed = 0.4;
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

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      enabled={mode === "active"}
      target={[0, 2, 0]}
    />
  );
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
      const ndc = new THREE.Vector3(conn.to.x, conn.to.y, conn.to.z).project(
        camera,
      );
      const behindCamera = ndc.z > 1;
      const rawX = ((ndc.x + 1) / 2) * size.width;
      const rawY = ((-ndc.y + 1) / 2) * size.height;

      const onScreen =
        !behindCamera &&
        rawX >= margin &&
        rawX <= size.width - margin &&
        rawY >= margin &&
        rawY <= size.height - margin;

      if (onScreen) return [];

      let dx = rawX - cx;
      let dy = rawY - cy;
      if (behindCamera) {
        dx = -dx;
        dy = -dy;
      }

      const scale = Math.min(
        (cx - margin) / (Math.abs(dx) || 0.01),
        (cy - margin) / (Math.abs(dy) || 0.01),
        1,
      );

      return [
        {
          name: conn.name,
          x: cx + dx * scale,
          y: cy + dy * scale,
          sport: conn.to.sport,
          dna: conn.to.dna,
          similarity: conn.similarity,
        },
      ];
    });

    const key = results
      .map((r) => `${r.name}:${Math.round(r.x)}:${Math.round(r.y)}`)
      .join("|");
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
            <Line
              points={[from, to]}
              color={lineColor}
              lineWidth={1.2}
              transparent
              opacity={0.55}
            />
            <Html position={to} occlude={false} zIndexRange={[99, 0]}>
              <ConnectionPill conn={conn} onMatchClick={onMatchClick} />
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function UniverseScene({
  mode = "active",
  points,
  colorBy,
  onHover,
  onSelect,
  selectedPlayer,
  matchConnections,
  onEdgeUpdate,
  onMatchClick,
  resetZoomRef,
}) {
  return (
    <Canvas camera={{ position: [0, 10, 28], fov: 60 }}>
      <ambientLight />
      {PERF_ENABLED && <PerfHUD />}
      <CameraRig
        selectedPlayer={selectedPlayer}
        resetZoomRef={resetZoomRef}
        mode={mode}
      />
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
        mode={mode}
      />
      {mode === "active" && (
        <GizmoHelper alignment="bottom-right" margin={[90, 90]}>
          <GizmoOverlay />
        </GizmoHelper>
      )}
    </Canvas>
  );
}
