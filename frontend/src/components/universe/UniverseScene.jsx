import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import PlayerPoints from "./PlayerPoints";

export default function UniverseScene({ points, colorBy, onHover, onSelect }) {
  return (
    <Canvas camera={{ position: [9, 0, 15.59], fov: 60 }}>
      <ambientLight />
      <OrbitControls enableDamping target={[0, 0, 0]} />
      <PlayerPoints
        points={points}
        colorBy={colorBy}
        onHover={onHover}
        onSelect={onSelect}
      />
    </Canvas>
  );
}
