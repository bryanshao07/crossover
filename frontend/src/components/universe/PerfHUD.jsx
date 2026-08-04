import { useEffect, useRef } from "react";
import { useFrame, useStore, useThree } from "@react-three/fiber";

// Dev-only performance overlay. Off unless the URL carries ?perf=1, and stripped
// from production builds entirely by the import.meta.env.DEV guard, so it costs
// nothing in a normal run. Renders no 3D objects, so it adds zero draw calls.
//
// Open /universe?perf=1 to read live FPS and draw calls off your own GPU --
// software/headless rendering cannot produce a meaningful FPS figure.
//
// Draw calls are counted by wrapping the WebGL draw entrypoints rather than by
// reading renderer.info.render.calls. three resets `info` at the start of every
// render pass, and drei's <GizmoHelper> issues a second pass after the main
// scene, so info.render.calls only ever describes that last little pass (8 here)
// -- not the frame. Wrapping the context counts every pass.
const DRAW_METHODS = [
  "drawElements",
  "drawArrays",
  "drawElementsInstanced",
  "drawArraysInstanced",
  "drawRangeElements",
];

const ROWS = [
  ["FPS", (s) => s.fps.toFixed(1)],
  ["DRAW CALLS", (s) => s.drawCalls],
  ["useFrame SUBS", (s) => s.useFrameSubscribers],
  ["PROGRAMS", (s) => s.programs],
  ["GEOMETRIES", (s) => s.geometries],
  ["TEXTURES", (s) => s.textures],
];

export default function PerfHUD() {
  const gl = useThree((s) => s.gl);
  const store = useStore();
  const elRef = useRef(null);
  const counterRef = useRef({ n: 0, lastFrame: 0 });
  const acc = useRef({ frames: 0, t0: 0, fps: 0 });

  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "top:8px",
      "right:8px",
      "z-index:99999",
      "background:rgba(10,10,15,0.92)",
      "border:1px solid #e8ff47",
      "color:#e8ff47",
      "font:11px/1.6 'JetBrains Mono',monospace",
      "letter-spacing:0.04em",
      "padding:9px 12px",
      "white-space:pre",
      "pointer-events:none",
      "backdrop-filter:blur(8px)",
    ].join(";");
    document.body.appendChild(el);
    elRef.current = el;
    return () => {
      el.remove();
      elRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = gl.getContext();
    const counter = counterRef.current;
    const originals = new Map();
    for (const name of DRAW_METHODS) {
      const orig = ctx[name];
      if (typeof orig !== "function") continue;
      originals.set(name, orig);
      ctx[name] = function (...args) {
        counter.n += 1;
        return orig.apply(this, args);
      };
    }
    return () => {
      for (const [name, orig] of originals) ctx[name] = orig;
    };
  }, [gl]);

  useFrame(() => {
    // useFrame runs before r3f's render, so everything counted since the last
    // tick is exactly one frame's worth of draw calls across all passes.
    const counter = counterRef.current;
    if (counter.n > 0) counter.lastFrame = counter.n;
    counter.n = 0;

    const a = acc.current;
    const now = performance.now();
    if (!a.t0) a.t0 = now;
    a.frames += 1;
    if (now - a.t0 < 500) return;

    a.fps = (a.frames * 1000) / (now - a.t0);
    a.frames = 0;
    a.t0 = now;

    const info = gl.info;
    const stats = {
      fps: a.fps,
      drawCalls: counter.lastFrame,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      useFrameSubscribers: store.getState().internal.subscribers.length,
    };
    window.__crossoverPerf = stats;

    if (elRef.current) {
      elRef.current.textContent = ROWS.map(
        ([label, read]) => `${label.padEnd(15)}${read(stats)}`,
      ).join("\n");
    }
  });

  return null;
}
