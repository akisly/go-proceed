"use client";

// Structure follows ln-dev7/circle's components/layout/sidebar (MIT:
// https://github.com/ln-dev7/circle) — the workspace switcher above a nav
// list above a user-menu slot. Every class name below is this system's own
// token role, never circle's CSS.

import type { ReactNode } from "react";
import { Camera, ClipboardList, LayoutDashboard, Users } from "lucide-react";
import { Avatar, AvatarFallback, Button, cx } from "@goproceed/ui/components";
import { WorkspaceSwitch, type Membership } from "./WorkspaceSwitch";

type NavItem = {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  reason: string;
};

/**
 * The four screens `docs/design/04-role-pain-map.md` names for this
 * dashboard (its screen 5, "navigation spine" — "nothing else has a home
 * without it"). None is built yet: D1 (evidence), D2 (overview), D3
 * (assignments), D4 (members) are separate slices later in Plan D. Every
 * item is a DISABLED control carrying its own `title`, never a link to a
 * route that would 404 — the brief's own rule, and the standard
 * `apps/app/qa/field.mjs` already holds the field client to.
 */
const NAV_ITEMS: NavItem[] = [
  {
    key: "overview", label: "Огляд", icon: LayoutDashboard,
    reason: "«Огляд» ще не реалізовано (заплановано у слайсі D2).",
  },
  {
    key: "assignments", label: "Доручення", icon: ClipboardList,
    reason: "«Доручення» ще не реалізовано (заплановано у слайсі D3).",
  },
  {
    key: "evidence", label: "Докази", icon: Camera,
    reason: "«Докази» ще не реалізовано (заплановано у слайсі D1).",
  },
  {
    key: "members", label: "Учасники", icon: Users,
    reason: "«Учасники» ще не реалізовано (заплановано у слайсі D4).",
  },
];

export function Sidebar({
  memberships, profileSlot, variant = "rail", className,
}: {
  memberships: Membership[];
  /**
   * TASK 3's SLOT — a plain `ReactNode` prop. `undefined` renders a clearly
   * marked placeholder rather than nothing, so this shell does not read as
   * broken before Task 3 lands, and rather than a fake identity: nothing in
   * this task's scope can read who is signed in (that is the Supabase
   * client-side session, which `apiGet`/`/v1/me/context` never expose — see
   * `apps/app/app/dash/layout.tsx`'s header comment).
   */
  profileSlot?: ReactNode | undefined;
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
  // Tailwind only sees a literal per §4.1's substitution table — never a
  // `${…}` template — so the collapse behaviour is two full class strings,
  // not one assembled from `variant`.
  const collapsible = isDrawer ? undefined : "rail-icons:hidden";

  return (
    <nav
      aria-label="Основна навігація"
      className={cx(
        "flex h-full flex-col gap-4 bg-canvas p-3",
        isDrawer
          ? "w-full"
          : "border-r border-line rail-icons:w-(--gp-rail-width-collapsed) wide:w-(--gp-rail-width-wide) w-(--gp-rail-width-wide)",
        className,
      )}
    >
      <WorkspaceSwitch memberships={memberships} className={collapsible} />

      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon, reason }) => (
          <li key={key}>
            <Button
              variant="ghost"
              disabled
              title={reason}
              aria-label={label}
              className="w-full justify-start px-2.5"
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              <span className={collapsible}>{label}</span>
            </Button>
          </li>
        ))}
      </ul>

      <div className={collapsible}>
        {profileSlot ?? <ProfilePlaceholder />}
      </div>
    </nav>
  );
}

/**
 * Task 3 replaces this with the real `ProfileMenu` (email, workspace role,
 * sign-out). Marked as a placeholder on its own face — the `title` — rather
 * than silently rendering nothing, so a reviewer of THIS task sees exactly
 * what is missing and why.
 */
function ProfilePlaceholder() {
  return (
    <div
      className="flex items-center gap-2 rounded-control border border-line-subtle px-2 py-2 text-meta text-ink-muted"
      title="Профіль і вихід з’являться в наступному завданні."
    >
      <Avatar>
        <AvatarFallback>—</AvatarFallback>
      </Avatar>
      <span>Профіль</span>
    </div>
  );
}
