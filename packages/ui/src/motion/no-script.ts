/**
 * WHAT A READER WITHOUT JAVASCRIPT SEES (BL-116, DEV-091).
 *
 * `Reveal` and `StaggerItem` server-render their hidden state inline
 * (`opacity: 0` and an offset) and only JavaScript ever clears it, so a page
 * read with scripting off — a reader mode, a crawler that does not execute, a
 * locked-down browser — painted each page's h1 and little else, the pilot form
 * among the missing. Each of them now marks its element `data-entrance`, and
 * a page puts this rule inside `<noscript>`, where only a browser with
 * scripting off reads it: the entrance is shown at rest instead.
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
