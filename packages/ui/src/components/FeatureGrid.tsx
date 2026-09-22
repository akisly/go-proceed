"use client";

import { useCallback, type PointerEvent, type ReactNode } from "react";
import { Stagger } from "../motion/Stagger";
import { cx } from "./cn";

/**
 * 21st.dev's «Grid Feature Cards»: one bordered container, cells separated by
 * a 1px gap that shows the container's line colour, and a dot-pattern
 * spotlight that follows the pointer inside a cell. The spotlight is a
 * pointer-driven CSS variable and an opacity transition — no Motion, no
 * transform, and it costs nothing when the pointer is elsewhere.
 *
 * The columns prop is a closed set so each value is a literal class: Tailwind
 * scans source text and a template literal emits no CSS.
 *
 * [2026-09-08] The cells no longer lean toward the pointer. `Tilt` was added
 * here on 2026-09-06 and taken out on the owner's call: the only surface on
 * the landing that follows the cursor is the hero's product frame. A grid of
 * role cards is read, not handled, and a page where every panel tips under the
 * cursor reads to this audience as a toy — §9's own argument. The spotlight
 * stays; it is a pointer-driven CSS variable, not motion.
 */
const COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 wide:grid-cols-3",
  4: "md:grid-cols-2 wide:grid-cols-4",
} as const;

export function FeatureGrid({
  children, columns = 4, className, stagger,
}: {
  children: ReactNode;
  columns?: keyof typeof COLUMNS | undefined;
  className?: string | undefined;
  /**
   * Staggers the cells in on scroll. A `motion.div` wrapping the children
   * with `display:contents` would preserve the grid, but `whileInView`'s
   * `IntersectionObserver` never fires on a boxless element — Chromium skips
   * a target with no CSS layout box entirely, so the "shown" variant would
   * never reach the cells and they would stay invisible forever (confirmed
   * against the live page, 2026-09-06). Instead, when `stagger` is on, the
   * grid container itself BECOMES the `Stagger`: its own box is real, so the
   * observer fires normally, and its children slot in as ordinary grid items
   * with no extra wrapper between them and their `grid-template-columns`.
   * Off by default so every non-landing caller is unchanged.
   */
  /** `"load"` where the grid is in the first fold of its page (DEV-026): under `on="view"` a grid already in view when the
   * reduced-motion gate opens can be left on `hidden` — measured on /roles, 3 loads in 5 — which is the case `Stagger`'s
   * own `on="load"` exists for. */
  stagger?: boolean | "load" | undefined;
}) {
  const base = ["grid gap-px overflow-hidden rounded-surface border border-line-strong", COLUMNS[columns]] as const;
  /* [2026-09-22, DEV-029] Staggered, the 1px gaps are drawn by each cell's own
   * outline, not by the container's fill. The fill is visible for as long as the
   * cells are fading in, so /roles opened on a solid grey slab the size of the
   * grid for a second and a half. An outline fades WITH its cell; overflow-hidden
   * clips the outer ones to the container's border, which stays. */
  /* The staggered children must be `StaggerItem`s, or anything else that takes
   * no focus: `*:outline` is a utility and would beat a direct child's own
   * `:focus-visible` ring. */
  return stagger
    ? <Stagger on={stagger === "load" ? "load" : "view"} className={cx(...base, "*:outline *:outline-line-strong", className)}>{children}</Stagger>
    : <div className={cx(...base, "bg-line-strong", className)}>{children}</div>;
}

export function FeatureCell({
  icon, iconClassName, title, titleAs: Title = "h3", subtitle, children, footer, className,
}: {
  icon?: ReactNode | undefined;
  /**
   * [2026-09-22, DEV-029] Additive, and empty by default, so every existing
   * caller renders exactly as before. It exists because the landing's role grid
   * gives each cell's icon one of four decorative index tints — the reference's
   * KPI chip row — and a tint that is bound to the ORDER of an enumeration has
   * no business being a variant of a shared component, where the next caller
   * would read it as a state.
   */
  iconClassName?: string | undefined;
  title: string;
  /** The title's level. `h3` by default; `h2` where the grid sits directly under a page's `h1` (DEV-025 R-02), so the outline never skips a level. */
  titleAs?: "h2" | "h3" | undefined;
  subtitle?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const onMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--gp-spot-x", `${((event.clientX - r.left) / r.width) * 100}%`);
    event.currentTarget.style.setProperty("--gp-spot-y", `${((event.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <article
        data-slot="feature-cell"
        onPointerMove={onMove}
        className={cx("group relative isolate grid content-start gap-3.5 bg-surface px-6 py-6", className)}
      >
        <i aria-hidden="true" data-spotlight="true" className="spotlight -z-10 opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100" />
        {icon && (
          <span className={cx("grid size-(--gp-control-height-touch) place-items-center rounded-panel border border-line-strong bg-surface text-ink [&_svg]:size-4.5", iconClassName)}>
            {icon}
          </span>
        )}
        <Title className="grid gap-0.5 text-body font-semibold tracking-tight text-ink">
          {title}
          {subtitle && <span className="text-meta font-normal text-ink-muted">{subtitle}</span>}
        </Title>
        <div className="text-data leading-relaxed text-ink-secondary">{children}</div>
        {footer && <div className="mt-1 grid gap-1.5 border-t border-line pt-3 text-data text-ink-secondary">{footer}</div>}
    </article>
  );
}
