import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

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

function colorFor(player, colorBy) {
  if (colorBy === "accent") return SPORT_COLORS.accent;
  return SPORT_COLORS[player.sport] ?? SPORT_COLORS.basketball;
}

// All 585 points live in one InstancedMesh, so the whole cloud is a single draw
// call. The quad is turned to face the camera in the vertex shader rather than
// on the CPU: we take the instance's translation into view space and offset by
// the quad's local XY, which is exactly what THREE.Sprite does — same look, same
// perspective size falloff — but without touching instanceMatrix every frame.
function billboardInstances(shader) {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <project_vertex>",
    `
    vec3 instanceOrigin = instanceMatrix[3].xyz;
    float instScaleX = length(instanceMatrix[0].xyz);
    float instScaleY = length(instanceMatrix[1].xyz);
    vec4 mvPosition = modelViewMatrix * vec4(instanceOrigin, 1.0);
    mvPosition.xy += transformed.xy * vec2(instScaleX, instScaleY);
    gl_Position = projectionMatrix * mvPosition;
    `,
  );
}

const _inverseMatrix = new THREE.Matrix4();
const _localRay = new THREE.Ray();
const _center = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const _hit = new THREE.Vector3();
const _bestHit = new THREE.Vector3();

// three's stock InstancedMesh.raycast intersects the quad as it is stored in
// instanceMatrix — an XY-plane card that is edge-on to the camera most of the
// time, since the billboarding happens in the shader. So it cannot be used here.
// Instead each point is tested as a sphere at its instance origin, which matches
// the round glow the user actually sees. Only the nearest hit is reported, so a
// point in front occludes one behind exactly as separate sprites did.
function raycastBillboardedInstances(raycaster, intersects) {
  const mesh = this;
  const attr = mesh.instanceMatrix;
  if (!attr) return;

  _inverseMatrix.copy(mesh.matrixWorld).invert();
  _localRay.copy(raycaster.ray).applyMatrix4(_inverseMatrix);

  const arr = attr.array;
  let bestId = -1;
  let bestDistSq = Infinity;

  for (let i = 0; i < mesh.count; i++) {
    const o = i * 16;
    _center.set(arr[o + 12], arr[o + 13], arr[o + 14]);
    // Scale-only matrices: elements 0 and 5 are the X and Y scale. Half of that
    // is the circle inscribed in the quad the sprite used to present.
    const radius = 0.5 * Math.max(arr[o], arr[o + 5]);
    _sphere.set(_center, radius);
    if (_localRay.intersectSphere(_sphere, _hit) === null) continue;
    const distSq = _localRay.origin.distanceToSquared(_hit);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = i;
      _bestHit.copy(_hit);
    }
  }

  if (bestId === -1) return;

  const point = _bestHit.clone().applyMatrix4(mesh.matrixWorld);
  const distance = raycaster.ray.origin.distanceTo(point);
  if (distance < raycaster.near || distance > raycaster.far) return;

  intersects.push({ distance, point, object: mesh, instanceId: bestId, face: null });
}

// An InstancedMesh's buffers are fixed at construction, so changing the count
// means rebuilding the mesh. Sport filters and the search box change the point
// count constantly, so capacity is allocated in power-of-two buckets and the
// live count is set with mesh.count. Rebuilds then happen only when the count
// crosses a bucket boundary rather than on every keystroke.
function capacityFor(n) {
  if (n === 0) return 0;
  return Math.max(256, 2 ** Math.ceil(Math.log2(n)));
}

// Writes only the scale terms of an instance matrix, leaving its translation
// untouched — the per-frame pulse never needs to rewrite position.
function setInstanceScale(mesh, i, s) {
  const arr = mesh.instanceMatrix.array;
  const o = i * 16;
  arr[o] = s;
  arr[o + 5] = s;
  arr[o + 10] = s;
}

export default function PlayerPoints({ points, colorBy, onHover, onSelect, selectedPlayerName }) {
  const meshRef = useRef();
  const hoveredRef = useRef(-1);
  const animatingRef = useRef(new Set());

  const glowTexture = useMemo(() => createGlowTexture(), []);
  const solidTexture = useMemo(() => createSolidTexture(), []);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    m.onBeforeCompile = billboardInstances;
    m.customProgramCacheKey = () => "player-points-billboard";
    return m;
  }, [glowTexture]);

  const capacity = capacityFor(points.length);

  const baseScales = useMemo(
    () => Float32Array.from(points, (p) => qualityToScale(p.quality)),
    [points],
  );

  const selectedIndex = useMemo(
    () => (selectedPlayerName ? points.findIndex((p) => p.name === selectedPlayerName) : -1),
    [points, selectedPlayerName],
  );

  // Full rewrite of positions, scales and colours. Runs only when the data or
  // the colour mode changes — not per frame.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    mesh.count = points.length;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(baseScales[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colorFor(p, colorBy));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Without this the cull test would use the unit quad's bounds at the origin
    // and drop the entire cloud whenever the origin left the frustum.
    mesh.computeBoundingSphere();

    hoveredRef.current = -1;
    animatingRef.current.clear();
  }, [points, colorBy, baseScales, capacity]);

  // One subscription for the whole cloud. Only the hovered and selected
  // instances are ever rewritten, so this is O(1) per frame regardless of how
  // many points are on screen.
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = state.clock.elapsedTime;
    const hovered = hoveredRef.current;
    const selected = selectedIndex;
    const animating = animatingRef.current;
    let dirty = false;

    for (const i of animating) {
      if (i === hovered || i === selected) continue;
      if (i < mesh.count) setInstanceScale(mesh, i, baseScales[i]);
      animating.delete(i);
      dirty = true;
    }

    if (selected >= 0 && selected < mesh.count) {
      const pulse = 1 + Math.sin(t * 4) * 0.12;
      setInstanceScale(mesh, selected, baseScales[selected] * 3.2 * pulse);
      animating.add(selected);
      dirty = true;
    }

    if (hovered >= 0 && hovered !== selected && hovered < mesh.count) {
      const pulse = 1 + Math.sin(t * 6) * 0.15;
      setInstanceScale(mesh, hovered, baseScales[hovered] * 1.8 * pulse);
      animating.add(hovered);
      dirty = true;
    }

    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  });

  // A single mesh stays "hovered" while the cursor slides between points, so the
  // enter/leave pair the old per-sprite handlers relied on never re-fires.
  // Tracking the instanceId change reproduces the same one-shot semantics.
  const handlePointerMove = useCallback(
    (e) => {
      e.stopPropagation();
      const id = e.instanceId;
      if (id == null || id >= points.length) return;
      if (hoveredRef.current === id) return;
      hoveredRef.current = id;
      onHover(points[id], e);
    },
    [points, onHover],
  );

  const handlePointerOut = useCallback(
    (e) => {
      e.stopPropagation();
      hoveredRef.current = -1;
      onHover(null);
    },
    [onHover],
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      const id = e.instanceId;
      if (id == null || id >= points.length) return;
      onSelect(points[id]);
    },
    [points, onSelect],
  );

  const selectedPoint = selectedIndex >= 0 ? points[selectedIndex] : null;
  const solidScale = selectedPoint ? baseScales[selectedIndex] * 1.1 : 0;

  return (
    <group>
      {capacity > 0 && (
        <instancedMesh
          key={capacity}
          ref={meshRef}
          args={[geometry, material, capacity]}
          raycast={raycastBillboardedInstances}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      )}
      {selectedPoint && (
        <sprite
          position={[selectedPoint.x, selectedPoint.y, selectedPoint.z]}
          scale={[solidScale, solidScale, solidScale]}
        >
          <spriteMaterial
            map={solidTexture}
            color={colorFor(selectedPoint, colorBy)}
            blending={THREE.NormalBlending}
            transparent={false}
            depthWrite={false}
          />
        </sprite>
      )}
    </group>
  );
}
