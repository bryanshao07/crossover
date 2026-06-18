import { useMemo } from "react";
import * as THREE from "three";
import { SPORT_COLOR } from "../../lib/attributes";

export default function PlayerPoints({ points, colorBy, onHover, onSelect }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.12, 8, 8), []);
  return (
    <group>
      {points.map((p) => {
        const color = colorBy === "sport" ? SPORT_COLOR[p.sport] : "#e8ff47";
        return (
          <mesh
            key={p.name}
            geometry={geometry}
            position={[p.x, p.y, p.z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(p, e); }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onSelect(p.name); }}
          >
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}
