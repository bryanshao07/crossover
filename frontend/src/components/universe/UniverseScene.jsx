import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import PlayerPoints from "./PlayerPoints";

const DEFAULT_TARGET = new THREE.Vector3(0, -2, 0);
const DEFAULT_CAMERA = new THREE.Vector3(9, -2, 15.59);

const CONN_COLORS = ["#ff6b9d", "#4af0c8", "#ffd44f", "#6bb5ff", "#ff9f43"];

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
        .subVectors(camera.position, controlsRef.current?.target ?? DEFAULT_TARGET)
        .normalize();
      animCamera.current.set(px, py, pz).addScaledVector(dir, 6);
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

function Connections({ selectedPlayer, matchConnections }) {
  if (!selectedPlayer || !matchConnections.length) return null;
  const from = [selectedPlayer.x, selectedPlayer.y, selectedPlayer.z];

  return (
    <group>
      {matchConnections.map((conn, i) => {
        const color = CONN_COLORS[i % CONN_COLORS.length];
        const to = [conn.to.x, conn.to.y, conn.to.z];
        return (
          <group key={conn.name}>
            <Line
              points={[from, to]}
              color={color}
              lineWidth={1.2}
              transparent
              opacity={0.55}
            />
            <Html
              position={to}
              occlude={false}
              zIndexRange={[40, 0]}
              style={{ pointerEvents: "none" }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "10px",
                fontWeight: 600,
                color,
                whiteSpace: "nowrap",
                padding: "2px 7px 2px 5px",
                border: `1px solid ${color}55`,
                background: "rgba(10,10,15,0.82)",
                letterSpacing: "0.03em",
                userSelect: "none",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: color, flexShrink: 0,
                }} />
                {conn.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function UniverseScene({ points, colorBy, onHover, onSelect, selectedPlayer, matchConnections }) {
  return (
    <Canvas camera={{ position: [9, -2, 15.59], fov: 60 }}>
      <ambientLight />
      <CameraRig selectedPlayer={selectedPlayer} />
      <Connections selectedPlayer={selectedPlayer} matchConnections={matchConnections ?? []} />
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
