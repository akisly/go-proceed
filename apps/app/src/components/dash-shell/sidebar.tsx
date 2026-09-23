"use client";

// Structure follows ln-dev7/circle's components/layout/sidebar (MIT:
// https://github.com/ln-dev7/circle) — the workspace switcher above a nav
// list above a user-menu slot. Every class name below is this system's own
// token role, never circle's CSS.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, UserRound, type LucideIcon } from "lucide-react";
import type { ProjectListRow } from "@goproceed/contracts";
import { cx } from "@goproceed/ui/components";
import { WorkspaceSwitch, type Membership } from "./workspace-switch";

/**
 * THREE GROUPS, AFTER THE OWNER'S REFERENCE (DEV-035, 2026-09-23): Uxerflow's
 * «Autumn – CRM Dashboard» sidebar — «Menu», «Projects», «Settings» — read as
 * structure only. Every item is a LINK to a route that exists.
 *
 * [Changed 2026-09-23. Until DEV-035 this rail held four DISABLED buttons —
 * «Огляд», «Доручення», «Докази», «Учасники» — each carrying the slice (D1–D4)
 * that would build it, because a link to a route that 404s is the one thing
 * this shell may not render. Three of those screens shipped PER PROJECT
 * (`/projects/{id}`, its register, `/assignments/{id}`), so they are
 * reached through the project list below and the project's own tabs, not
 * through a global item. «Учасники» (D4) is not built; it gets an item the day
 * its route exists, not a disabled placeholder before.]
 *
 * THE PROJECT TILES ARE AN INDEX. Their four tints are the `chip-*` roles,
 * bound to the ORDER of the list (DESIGN.md, DEV-029), never to anything a
 * project is — four literal class strings, cycled by position.
 */
const PROJECT_TINTS = [
  "bg-chip-clay text-chip-clay-fg",
  "bg-chip-violet text-chip-violet-fg",
  "bg-chip-pine text-chip-pine-fg",
  "bg-chip-stone text-chip-stone-fg",
] as const;

export function Sidebar({
  memberships, projects, profileSlot, variant = "rail", className,
}: {
  memberships: Membership[];
  /** Every project `GET /v1/projects` returns to this member, in its order. */
  projects: ProjectListRow[];
  /**
   * The profile control — `ProfileMenu`, built once in
   * `src/layouts/dash-layout.tsx` and handed to both this rail and the
   * drawer inside `TopBar`.
   *
   * REQUIRED, NOT OPTIONAL, since Task 3. It was `profileSlot?: ReactNode`
   * with a placeholder fallback while the real menu did not exist; leaving it
   * optional now would mean a future caller could drop the ONLY way to sign
   * out of this product and get a shell that renders perfectly, with nothing
   * red anywhere. A required prop makes that a type error at the call site.
   */
  profileSlot: ReactNode;
  /**
   * "rail" — the persistent desktop sidebar: icon-only between `md` and
   * `wide` (the `rail-icons` custom variant), labelled at `wide` and up.
   * "drawer" — rendered inside `TopBar`'s mobile `Dialog`: always full
   * labels, since the drawer's own width never collapses to icons.
   */
  variant?: "rail" | "drawer" | undefined;
  className?: string | undefined;
}) {
  const isDrawer = variant === "drawer";
  const pathname = usePathname();
  // Tailwind only sees a literal per §4.1's substitution table — never a
  // `${…}` template — so the collapse behaviour is two full class strings,
  // not one assembled from `variant`. A LABEL collapses to `sr-only`, not to
  // `hidden`: in the icon rail the link keeps its accessible name.
  const collapsible = isDrawer ? undefined : "rail-icons:hidden";
  const labelCollapsible = isDrawer ? undefined : "rail-icons:sr-only";

  return (
    <nav
      aria-label="Основна навігація"
      className={cx(
        "flex h-full flex-col gap-5 bg-canvas p-3",
        isDrawer
          ? "w-full"
          : "rail-icons:w-(--gp-rail-width-collapsed) wide:w-(--gp-rail-width-wide) w-(--gp-rail-width-wide)",
        className,
      )}
    >
      <WorkspaceSwitch memberships={memberships} className={collapsible} />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <NavGroup label="Меню" labelClassName={collapsible}>
          <NavItem
            href="/"
            label="Усі проєкти"
            current={pathname === "/" ? "page" : undefined}
            labelClassName={labelCollapsible}
            icon={<ItemIcon icon={LayoutGrid} />}
          />
        </NavGroup>

        {projects.length > 0 && (
          <NavGroup label="Проєкти" labelClassName={collapsible}>
            {projects.map((project, i) => {
              const href = `/projects/${project.projectId}`;
              return (
                <NavItem
                  key={project.projectId}
                  href={href}
                  label={project.name}
                  current={pathname === href ? "page" : pathname.startsWith(`${href}/`) ? "location" : undefined}
                  labelClassName={labelCollapsible}
                  icon={(
                    <span
                      aria-hidden="true"
                      className={cx(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-control",
                        "text-meta font-semibold leading-none tracking-tight",
                        PROJECT_TINTS[i % PROJECT_TINTS.length],
                      )}
                    >
                      {monogram(project.name)}
                    </span>
                  )}
                />
              );
            })}
          </NavGroup>
        )}
      </div>

      <NavGroup label="Налаштування" labelClassName={collapsible}>
        <NavItem
          href="/settings/profile"
          label="Профіль"
          current={pathname === "/settings/profile" ? "page" : undefined}
          labelClassName={labelCollapsible}
          icon={<ItemIcon icon={UserRound} />}
        />
      </NavGroup>

      {/*
        * NO `collapsible` HERE — TASK 3's DEFECT 1, AND IT WAS NOT COSMETIC.
        * This wrapper used to carry the same `rail-icons:hidden` as the nav
        * labels, which meant the ENTIRE profile block was `display: none`
        * between 768px and 1240px — an ordinary office laptop window — and
        * therefore that once the real menu landed there would still have been
        * NO WAY TO SIGN OUT at that width. The label may collapse; the
        * control may not. The collapse now lives on the address inside
        * `ProfileMenu`, exactly as a nav item above keeps its icon and drops
        * its `<span>`.
        */}
      {profileSlot}
    </nav>
  );
}

/**
 * One or two letters a project is recognisable by in the 768–1240 icon rail,
 * where its label is `sr-only` (UI review U1-05: three identical folders told
 * apart only by a tint bound to list order). The first letter of the first
 * two words, split on spaces and hyphens; «Проєкт» with no letter at all.
 */
export function monogram(name: string): string {
  const words = name.split(/[\s\-–—]+/u).filter((w) => /\p{L}|\p{N}/u.test(w));
  const initials = words.slice(0, 2).map((w) => [...w].find((c) => /\p{L}|\p{N}/u.test(c))!.toUpperCase());
  return initials.join("") || "П";
}

function NavGroup({
  label, labelClassName, children,
}: {
  label: string;
  labelClassName?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className={cx("px-2.5 pb-1 text-meta font-medium uppercase tracking-wide text-ink-muted", labelClassName)}>
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function ItemIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />;
}

/**
 * The current item is a white sheet lifted by `shadow-raised` — the
 * reference's active item — and says so in `aria-current`, not with the
 * colour alone: `"page"` when the link IS this page, `"location"` when this
 * page lives under it (a project's register under the project), so a screen
 * reader hears one «current page» per screen (DEV-035 review, R1-05).
 *
 * Every item carries its label as a `title`: in the 768–1240 icon rail the
 * label is `sr-only`, and the tooltip gives the full name behind a project's
 * monogram (R1-06, U1-05; BL-053's ruling asks for one there). Height is
 * the control height, 44px under a coarse pointer.
 */
function NavItem({
  href, label, current, icon, labelClassName,
}: {
  href: string;
  label: string;
  current: "page" | "location" | undefined;
  icon: ReactNode;
  labelClassName?: string | undefined;
}) {
  const active = current !== undefined;
  return (
    <li>
      <Link
        href={href}
        title={label}
        aria-current={current}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-control border px-2.5 text-data",
          "h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)",
          "transition-colors duration-fast ease-out",
          active
            ? "border-line bg-surface font-medium text-ink shadow-raised"
            : "border-transparent text-ink-secondary hover:bg-action-ghost-hover hover:text-ink",
        )}
      >
        {icon}
        <span className={cx("min-w-0 flex-1 truncate", labelClassName)}>{label}</span>
      </Link>
    </li>
  );
}
