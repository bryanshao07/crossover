import { useMemo } from "react";
import * as THREE from "three";
import { SPORT_COLOR } from "../../lib/attributes";

export default function PlayerPoints({ points, colorBy, onHover, onSelect }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.12, 8, 8), []);

  const materials = useMemo(() => {
    if (colorBy === "accent") {
      return { accent: new THREE.MeshBasicMaterial({ color: "#e8ff47" }) };
    }
    return {
      basketball: new THREE.MeshBasicMaterial({ color: SPORT_COLOR.basketball }),
      soccer: new THREE.MeshBasicMaterial({ color: SPORT_COLOR.soccer }),
    };
  }, [colorBy]);

  return (
    <group>
      {points.map((p) => {
        const material =
          colorBy === "accent"
            ? materials.accent
            : materials[p.sport];
        return (
          <mesh
            key={p.name}
            geometry={geometry}
            material={material}
            position={[p.x, p.y, p.z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(p, e); }}
            onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            onClick={(e) => { e.stopPropagation(); onSelect(p.name); }}
          />
        );
      })}
    </group>
  );
}
