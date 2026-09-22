/**
 * The particle dome's model (DEV-026) — the arithmetic `ParticleSphere` shares
 * between its still 2D frame and its three.js scene, so the fallback and the
 * scene are the same dome and not two drawings that drift apart. No import of
 * three.js here: this file is in the first bundle, the scene is not.
 *
 * Everything is in CSS px, origin at the centre of the canvas, y up, z toward
 * the viewer. The sphere's centre sits BELOW the canvas's foot, so only its cap
 * shows — a dome rising out of the block's lower edge.
 */
export interface Dome {
  /** Sphere radius. */
  radius: number;
  /** The sphere's centre: x is the canvas centre, y is below its foot. */
  centreY: number;
  count: number;
  /** Unit vectors, xyz interleaved — a Fibonacci lattice, so the dots sit on visible spirals. */
  home: Float32Array;
}

/** How much of the radius rises above the canvas's foot. */
const RISE = 0.62;
/** The dome leans its pole toward the viewer, so the spirals' eye is in view. */
export const TILT = 0.5;

/**
 * `head` is the part of the canvas kept EMPTY above the dome's apex (px). With
 * none, the apex sits on the canvas's top edge, and the top dots are cut in
 * half there — more so at the height of the breath, and every dot the pointer
 * throws upward vanishes at the edge (owner, third pass: «верхние точки у него
 * обрезаются»). The reference's canvas is far larger than its dome for the
 * same reason.
 */
export function buildDome(width: number, height: number, head = 0): Dome {
  // The cap should fill the canvas below its headroom; the radius follows from it, within what the width allows.
  const radius = Math.max(120, Math.min((height - head) / RISE, width * 0.46));
  const centreY = -height / 2 - radius * (1 - RISE);
  // Dot density is constant on the sphere's surface: about one dot per 300 px²,
  // the whole sphere — the far side is there too, it turns into view.
  const count = Math.max(1200, Math.min(12000, Math.round((4 * Math.PI * radius * radius) / 300)));
  const home = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    home[i * 3] = Math.cos(golden * i) * ring;
    home[i * 3 + 1] = y;
    home[i * 3 + 2] = Math.sin(golden * i) * ring;
  }
  return { radius, centreY, count, home };
}

/**
 * Where every dot stands at spin angle `spin` and breath `swell` (≈1): writes
 * xyz in px into `out`. The pole turns about the sphere's own axis, which is
 * tilted toward the viewer by `TILT`.
 */
export function placeDome(dome: Dome, spin: number, swell: number, out: Float32Array): void {
  const cs = Math.cos(spin), sn = Math.sin(spin);
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  const r = dome.radius * swell;
  for (let i = 0; i < dome.count; i++) {
    const hx = dome.home[i * 3]!, hy = dome.home[i * 3 + 1]!, hz = dome.home[i * 3 + 2]!;
    // spin about y, then tilt about x
    const x = hx * cs + hz * sn;
    const z0 = -hx * sn + hz * cs;
    const y = hy * ct - z0 * st;
    const z = hy * st + z0 * ct;
    out[i * 3] = x * r;
    out[i * 3 + 1] = dome.centreY + y * r;
    out[i * 3 + 2] = z * r;
  }
}

/**
 * The dome's silhouette as a disc in the canvas's own CSS px (origin top-left,
 * y down): what `ParticleSphere` publishes on its box so that a `CellField`
 * under it can keep its cells dark UNDER THE DOME and alive beside it.
 */
export function domeDisc(width: number, height: number, head = 0): { cx: number; cy: number; r: number } {
  const dome = buildDome(width, height, head);
  return { cx: width / 2, cy: height / 2 - dome.centreY, r: dome.radius };
}

/** A dot's brightness from its depth: full on the near face, thinning to the limb, nothing behind it — the far side reads as noise through the near one, and a dot just behind the limb pairs with one just in front of it into a dash (B-05). */
export function shade(z: number, radius: number): number {
  const d = z / radius;
  return d >= 0 ? 0.3 + 0.7 * d : 0;
}

/** The still frame: the same dome as flat discs on a 2D canvas — reduced motion, no WebGL, and the moment before the scene's first frame. */
export function drawStillDome(canvas: HTMLCanvasElement, head = 0): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(canvas).color;
  const dome = buildDome(w, h, head);
  const at = new Float32Array(dome.count * 3);
  placeDome(dome, 0.6, 1, at);
  for (let i = 0; i < dome.count; i++) {
    const x = w / 2 + at[i * 3]!;
    const y = h / 2 - at[i * 3 + 1]!;
    if (y > h + 4 || y < -4) continue;
    const z = at[i * 3 + 2]!;
    const light = shade(z, dome.radius);
    if (light <= 0) continue;
    ctx.globalAlpha = light * 0.92;
    const size = 1 + Math.max(0, z / dome.radius) * 1.1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
