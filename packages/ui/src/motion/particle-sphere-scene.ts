/**
 * `ParticleSphere`'s three.js scene (DEV-026). This module is the ONLY place
 * three.js is imported, and `ParticleSphere` imports it dynamically, so
 * three.js is a chunk of its own that the first screen never waits for.
 * Named imports only: the bundler drops what the scene does not name.
 *
 * three.js 0.186.0 (r186), WebGL 2 only — r163 dropped WebGL 1. Checked
 * against the installed `@types/three@0.186.0` and the migration guide
 * (https://github.com/mrdoob/three.js/wiki/Migration-Guide, read 2026-09-19).
 *
 * The scene is small on purpose: one `Points` object over one dynamic position
 * buffer, an orthographic camera in CSS px, two short shaders that draw a round
 * dot and dim it with depth. The dots' places — spin, tilt, breath, and the
 * scatter from the pointer — are computed on the CPU in `frame()`: five
 * thousand dots is a few dozen microseconds, and it keeps the still 2D
 * fallback and the scene on one model (`particle-sphere-model.ts`).
 *
 * The shaders are written for this file; nothing of the reference's is here.
 */
import {
  BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, OrthographicCamera,
  Points, Scene, ShaderMaterial, WebGLRenderer,
} from "three";
import { buildDome, placeDome, type Dome } from "./particle-sphere-model";
import type { CanvasScene } from "./canvas-loop";

const VERTEX = /* glsl */ `
  uniform float uRadius;
  uniform float uSize;
  varying float vShade;
  void main() {
    float d = position.z / uRadius;
    vShade = d >= 0.0 ? 0.3 + 0.7 * d : 0.0;
    gl_PointSize = uSize * (0.62 + 0.5 * max(d, 0.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  varying float vShade;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float disc = 1.0 - smoothstep(0.36, 0.5, r);
    if (disc <= 0.0) discard;
    gl_FragColor = vec4(uColour, disc * vShade * 0.92);
  }
`;

/** The computed `color` as three numbers, whatever syntax the browser serialised it in. */
function readColour(css: string): [number, number, number] {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255];
}

export interface SphereScene extends CanvasScene {
  /** The pointer in CSS px from the canvas's top-left, or `null` when it has left. */
  point(at: { x: number; y: number } | null): void;
  dispose(): void;
}

/**
 * `context` is the caller's: `ParticleSphere` asks the canvas for WebGL 2 BEFORE
 * it imports this module, so a browser without it never downloads three.js
 * (R-10), and the renderer — which logs a console error before it throws when
 * IT fails to get a context — is never asked to. If the renderer still throws,
 * the context is released before the error leaves (R-04).
 */
export function createSphereScene(canvas: HTMLCanvasElement, context: WebGL2RenderingContext, head = 0): SphereScene {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
  } catch (error) {
    context.getExtension("WEBGL_lose_context")?.loseContext();
    throw error;
  }
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
  const material = new ShaderMaterial({
    uniforms: { uColour: { value: new Color() }, uRadius: { value: 1 }, uSize: { value: 4 } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthTest: false, depthWrite: false,
  });
  let geometry = new BufferGeometry();
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let dome: Dome | null = null;
  let at = new Float32Array(0);
  /** Each dot's displacement from its place, and its velocity — xyz, px. */
  let push = new Float32Array(0);
  let speed = new Float32Array(0);
  let width = 0, height = 0;
  let spin = 0.6;
  let clock = 0;
  let pointer: { x: number; y: number } | null = null;

  return {
    resize(w, h, ratio, colour) {
      width = w; height = h;
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h, false);
      camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      dome = buildDome(w, h, head);
      at = new Float32Array(dome.count * 3);
      push = new Float32Array(dome.count * 3);
      speed = new Float32Array(dome.count * 3);
      geometry.dispose();
      geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(at, 3).setUsage(DynamicDrawUsage));
      points.geometry = geometry;
      const [r, g, b] = readColour(colour);
      // No colour space named (R-02): the shader writes `uColour` straight out, with
      // no output conversion, so the numbers must stay the sRGB ones the 2D still
      // layer paints with. Naming sRGB here would linearise them and darken the dots.
      (material.uniforms.uColour!.value as Color).setRGB(r, g, b);
      material.uniforms.uRadius!.value = dome.radius;
      material.uniforms.uSize!.value = 4.4 * ratio;
    },
    frame(_now, dt) {
      if (!dome) return true;
      clock += dt;
      // One turn in a hundred seconds; the breath is ±1.2 % of the radius on a 7 s swell.
      spin += (dt / 1000) * ((Math.PI * 2) / 100);
      placeDome(dome, spin, 1 + 0.012 * Math.sin((clock / 1000) * ((Math.PI * 2) / 7)), at);
      const step = Math.min(dt, 34) / 1000;
      const px = pointer ? pointer.x - width / 2 : 0;
      const py = pointer ? height / 2 - pointer.y : 0;
      const reach = 96;
      for (let i = 0; i < dome.count; i++) {
        const j = i * 3;
        if (pointer && at[j + 2]! > 0) {
          // THE SCATTER: a dot within reach of the pointer is thrown outward, along the
          // line from the pointer through it, and a little toward the viewer.
          const dx = at[j]! + push[j]! - px;
          const dy = at[j + 1]! + push[j + 1]! - py;
          const dist = Math.hypot(dx, dy);
          if (dist < reach) {
            const force = (1 - dist / reach) * 5200 * step;
            const inv = 1 / Math.max(dist, 6);
            speed[j] = speed[j]! + dx * inv * force;
            speed[j + 1] = speed[j + 1]! + dy * inv * force;
            speed[j + 2] = speed[j + 2]! + force * 0.35;
          }
        }
        // …and a damped spring brings it home.
        for (let a = 0; a < 3; a++) {
          const k = j + a;
          if (push[k] === 0 && speed[k] === 0) continue;
          speed[k] = (speed[k]! - push[k]! * 38 * step) * Math.exp(-4.2 * step);
          push[k] = push[k]! + speed[k]! * step;
          if (Math.abs(push[k]!) < 0.02 && Math.abs(speed[k]!) < 0.02) { push[k] = 0; speed[k] = 0; }
          at[k] = at[k]! + push[k]!;
        }
      }
      (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
      renderer.render(scene, camera);
      return true;
    },
    point(next) { pointer = next; },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      // Frees the context now rather than at garbage collection: a client-side
      // route change back to the home page mounts a new one, and a browser
      // holds only so many.
      renderer.forceContextLoss();
    },
  };
}
