/**
 * The one frame loop the canvas words share (DEV-027). Not a primitive — the
 * plumbing under `PixelRain`, `CellField`, `ArcField` and `ParticleSphere`, so
 * the rules a canvas must keep are written once and not four times:
 *
 *  - THE LOOP IS CANCELLED, NOT IDLED, while the canvas is off screen or the
 *    tab is hidden (DEV-026 R-12): a rAF callback that returns early still
 *    wakes the main thread sixty times a second;
 *  - A SCENE THAT HAS NOTHING LEFT TO DRAW RESTS. `frame()` answers whether it
 *    wants another frame; on `false` no callback is pending at all until
 *    `wake()` — a pointer reaction costs nothing between two movements;
 *  - the colour is the canvas's computed `color`, a token role chosen by the
 *    caller's class, re-read on every resize — no value is written in a scene;
 *  - the caller sizes the canvas in CSS; the bitmap follows the box from a
 *    ResizeObserver, at a device-pixel ratio capped at 2;
 *  - `fps` throttles by skipping callbacks, for a texture that is a shimmer and
 *    not a simulation.
 *
 * Reduced motion is the caller's branch, not a flag here: a word under reduced
 * motion draws its still frame and never mounts a loop — a different
 * composition, not a slower one.
 */
export interface CanvasScene {
  /** The box changed, or the scene has just mounted. Sizes are CSS px; `colour` is the computed `color`. */
  resize(width: number, height: number, ratio: number, colour: string): void;
  /** Draw one frame. `dt` is ms since the last drawn frame (0 on the first). Return whether another frame is wanted. */
  frame(now: number, dt: number): boolean;
}

export interface CanvasLoop {
  /** Ask for frames again after the scene rested — a pointer moved. */
  wake(): void;
  /** Draw once, outside the loop (a still frame). */
  drawOnce(): void;
  stop(): void;
}

export function mountCanvasLoop(
  canvas: HTMLCanvasElement,
  scene: CanvasScene,
  { run = true, fps, onState }: {
    /** `false` mounts the resize plumbing only: the still frame of reduced motion. */
    run?: boolean | undefined;
    fps?: number | undefined;
    /** QA hook: the canvas's `data-*` state follows the loop. */
    onState?: ((state: "running" | "resting" | "paused") => void) | undefined;
  } = {},
): CanvasLoop {
  let handle = 0;
  let last = 0;
  let onScreen = true;
  let wanted = run;
  const gap = fps ? 1000 / fps : 0;

  function measure(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    // `clientWidth`, not the rect: inside a 3D-transformed plane the rect is the
    // projected box, and the bitmap has to follow the element's own size.
    const w = canvas.clientWidth || width;
    const h = canvas.clientHeight || height;
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    scene.resize(w, h, ratio, getComputedStyle(canvas).color);
  }

  function tick(now: number): void {
    handle = 0;
    if (gap && last && now - last < gap) { handle = requestAnimationFrame(tick); return; }
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    wanted = scene.frame(now, dt);
    if (wanted) handle = requestAnimationFrame(tick);
    else { last = 0; onState?.("resting"); }
  }

  function sync(): void {
    if (handle) { cancelAnimationFrame(handle); handle = 0; }
    if (!run) return;
    if (!onScreen || document.hidden) { last = 0; onState?.("paused"); return; }
    if (wanted) { onState?.("running"); handle = requestAnimationFrame(tick); } else onState?.("resting");
  }

  measure();
  scene.frame(performance.now(), 0);

  const resize = new ResizeObserver(() => { measure(); scene.frame(performance.now(), 0); });
  resize.observe(canvas);
  const visible = new IntersectionObserver(([entry]) => { onScreen = entry?.isIntersecting ?? true; sync(); });
  visible.observe(canvas);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    wake() { if (!run || wanted) return; wanted = true; sync(); },
    drawOnce() { scene.frame(performance.now(), 0); },
    stop() {
      if (handle) cancelAnimationFrame(handle);
      handle = 0;
      document.removeEventListener("visibilitychange", sync);
      resize.disconnect();
      visible.disconnect();
    },
  };
}

/**
 * A pointer followed in an element's own coordinates, only under
 * `(pointer: fine)` — a thumb has nothing to follow, and a touch device keeps
 * the calm composition. The query is read once, at mount; and the position is
 * the last one HEARD — a page scrolled under a resting pointer keeps it until
 * the next move or leave (R-14, accepted: a held cell a few px stale).
 * `track` is where the listener sits:
 *
 *  - `"self"` reads `offsetX/offsetY`, which the browser resolves through the
 *    element's transforms — the hero floor is a plane under CSS perspective and
 *    no arithmetic here could invert that as exactly;
 *  - `"parent"` listens on the nearest ancestor that takes pointer events, so
 *    a ground that lies UNDER a section's content still hears the pointer over
 *    that content; the element is flat there and the rect is enough.
 */
/** `(pointer: fine)` right now — a word that exists only to follow a pointer mounts nothing without one. */
export function pointerIsFine(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
}

export function followPointer(
  el: HTMLElement,
  track: "self" | "parent",
  onMove: (x: number, y: number) => void,
  onLeave: () => void,
): () => void {
  if (!pointerIsFine()) return () => {};
  // The nearest ancestor that takes pointer events at all: a canvas word's own
  // wrapper is `pointer-events: none`, and a listener there would hear nothing.
  let target: HTMLElement = el;
  if (track === "parent") {
    let up = el.parentElement;
    while (up && getComputedStyle(up).pointerEvents === "none") up = up.parentElement;
    target = up ?? el;
  }
  function move(event: PointerEvent): void {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (track === "self") { onMove(event.offsetX, event.offsetY); return; }
    const r = el.getBoundingClientRect();
    onMove(event.clientX - r.left, event.clientY - r.top);
  }
  target.addEventListener("pointermove", move, { passive: true });
  target.addEventListener("pointerleave", onLeave, { passive: true });
  return () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerleave", onLeave);
  };
}
