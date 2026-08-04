# Batching the universe point cloud — design + measurements

Date: 2026-08-04
Scope: `frontend/src/components/universe/PlayerPoints.jsx` (+ a dev-only perf HUD)

## Problem

`PlayerPoints` mounted one `<sprite>` per player. At 585 players that is 585
scene objects, 585 draw calls, and 585 `useFrame` subscriptions — one per point,
each recomputing a scale every frame even though at most two points (the hovered
one and the selected one) are ever animating.

## Approach

One `THREE.InstancedMesh` for the whole cloud.

- **Geometry/material**: a unit `PlaneGeometry` with `MeshBasicMaterial`, the
  existing radial-gradient glow texture, additive blending, `depthWrite: false`.
- **Billboarding in the vertex shader**, via `onBeforeCompile` replacing
  `<project_vertex>`: the instance origin goes to view space and the quad's local
  XY is added there. That is what `THREE.Sprite` does internally, so the look and
  the perspective size falloff are unchanged — and crucially the CPU never has to
  rewrite `instanceMatrix` to keep quads facing the camera.
- **Per-instance data**: position and scale in `instanceMatrix`, colour in
  `instanceColor` (`setColorAt`). Written once per data/colour change, not per
  frame.
- **One `useFrame`** for the entire cloud. It rewrites only the scale terms of
  the hovered and selected instances and resets ones that stopped animating, so
  per-frame work is O(1) rather than O(585).

### Raycasting

three's stock `InstancedMesh.raycast` intersects the quad *as stored in
`instanceMatrix`* — an XY-plane card that is edge-on to the camera most of the
time, because billboarding happens in the shader. It is therefore unusable here
and is replaced with a ray/sphere test per instance, reporting only the nearest
hit. A sphere matches the round glow better than the old square sprite quad did,
and because the pulse writes its enlarged scale into `instanceMatrix`, the hit
area grows with the visual exactly as before.

### Instance count

Instance buffers are fixed at construction, but the sport filter and the search
box change the point count constantly. Capacity is therefore allocated in
power-of-two buckets (min 256) with the live count set via `mesh.count`, so the
mesh is rebuilt only when the count crosses a bucket boundary instead of on every
keystroke.

`computeBoundingSphere()` is called after each rewrite. Without it the cull test
would use the unit quad's bounds at the origin and drop the whole cloud whenever
the origin left the frustum.

## Measurements

Draw calls counted by wrapping the WebGL draw entrypoints (`drawElements`,
`drawArrays`, `draw*Instanced`, `drawRangeElements`) before any page script runs,
attributing calls to animation frames. That counter is CPU-side and
driver-independent, so headless SwiftShader reports exactly what a real GPU
would. Cross-checked by an independent in-app HUD; both agree.

Note: `renderer.info.render.calls` is *not* usable as a frame total here — three
resets `info` per render pass and drei's `<GizmoHelper>` adds a second pass, so
it only ever reports that last pass (8).

| Metric (per frame, `/universe`, 1440x900, 585 points) | Before | After |
| --- | --- | --- |
| GL draw calls, idle | 593 | 9 |
| GL draw calls, hovering a point | 593 | 9 |
| GL draw calls, player selected | 599 | 15 |
| `useFrame` subscriptions | 595 | 11 |

`PlayerPoints`' own contribution: **585 draw calls -> 1**, and **585 useFrame
subscriptions -> 1**. The residual 8 draw calls and 10 subscriptions belong to
the gizmo, controls and overlays, which this change did not touch. Selection adds
+6 in both versions (1 solid core sprite + 5 connection lines).

FPS was deliberately not measured here: headless rendering is software
rasterized, so any figure would say nothing about a real GPU. `/universe?perf=1`
renders a dev-only HUD for reading FPS and draw calls on real hardware.

## Verification

- Hovering the same pixel resolves to the same player (`Luguentz Dort`, matching
  DNA string) before and after; click still opens the popup.
- Idle and selected screenshots are visually indistinguishable from the baseline;
  camera zoom, connection lines and the edge-projected pill all still work.
- Sport filter, search filter and both `colorBy` modes hold at 9 draw calls with
  no page errors, including across a capacity-bucket rebuild.
- `npm run lint`: 5 problems before and after, all pre-existing and in untouched
  files. The three touched files lint clean.
- Backend `pytest`: 74 passed, 3 failed — all three fail on `psycopg2`
  "Connection refused" to Postgres on port 5432, unrelated to this frontend
  change.

## Tradeoffs

- **Independent per-point animation is now bounded.** Animating many points at
  once means writing that many matrices per frame; the design assumes only the
  hovered and selected points animate. A future "animate every point" effect
  would want the pulse moved into the shader.
- **Transparency sorting is per-cloud, not per-point.** three can no longer depth
  sort points against each other. This is safe *only* because the glow is
  additively blended with `depthWrite: false`, where draw order does not change
  the result. Switching the glow to normal alpha blending would expose ordering
  artefacts.
- **Hover hit area is a sphere, not the old square quad** — the inscribed circle
  of the previous area, so extreme corner pixels of a point no longer register.
  Verified as imperceptible at these point sizes.
- **The shader patch is coupled to three's `<project_vertex>` chunk.** A three
  upgrade that renames or restructures that chunk would break billboarding
  loudly (points would render unbillboarded), not silently.
