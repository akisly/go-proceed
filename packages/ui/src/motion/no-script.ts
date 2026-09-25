/**
 * WHAT A READER WITHOUT JAVASCRIPT SEES (BL-116, DEV-091).
 *
 * The entrance words server-render their hidden state inline and only
 * JavaScript ever clears it — `opacity: 0`, since `useReduced()` is true on the
 * server and the reduced branch renders — so a page
 * read with scripting off — a reader mode, a crawler that does not execute, a
 * locked-down browser — painted each page's h1 and little else, the pilot form
 * among the missing. Each of them now marks its element `data-entrance`, and
 * a page puts this rule inside `<noscript>`, where only a browser with
 * scripting off reads it: the entrance is shown at rest instead. The marked
 * words: `Reveal`, `StaggerItem`, `NodeLock`, and the reduced branch of
 * `TextBlurIn` and `LineReveal` (every word that renders `opacity: 0` on the
 * server; DEV-091 gp-reviewer R1). `transform` and `filter` are undone too,
 * defensively: no server branch sets them today (R2).
 *
 * The CSS `entrance` utility (`base.css`) runs without JavaScript, but a
 * wrapper carrying it may take the mark too: an `!important` declaration
 * beats an animation, so its scriptless paint does not wait on the animation's
 * timing (the landing hero, DEV-091 gp-ui-reviewer U1).
 *
 * SCOPED TO THE MARKER, NOT TO `opacity`. A blanket rule would also show what
 * is hidden on purpose — a word's inactive panel, a decorative layer — and
 * `!important` in a stylesheet beats the inline style Motion rendered, which
 * carries none. With scripting on, the `<noscript>` body is inert text: first
 * paint and every entrance are unchanged.
 *
 * Not covered: scripting on but a chunk that fails to load. The entrance then
 * stays hidden, as before (BL-207).
 *
 * No directive and no imports: the root layout, a server component, reads it.
 */
export const ENTRANCE_ATTRIBUTE = "data-entrance";

export const NO_SCRIPT_ENTRANCE_CSS =
  `[${ENTRANCE_ATTRIBUTE}]{opacity:1!important;transform:none!important;filter:none!important}`;
