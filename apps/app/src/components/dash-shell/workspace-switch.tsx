import type { MeContextResponse } from "@goproceed/contracts";
import { Building2, ChevronsUpDown } from "lucide-react";
import { cx } from "@goproceed/ui/components";

export type Membership = MeContextResponse["memberships"][number];

/**
 * The workspace identity at the top of the rail.
 *
 * NOT AN ACTUAL SWITCHER YET, AND SAID SO ON THE ELEMENT ITSELF.
 * `GET /v1/projects` is already cross-workspace (its own route comment:
 * "RLS … IS the filter" — no workspace id is ever sent), and nothing in this
 * shell scopes a screen to one membership. Rendering a working `DropdownMenu`
 * here — the component Task 1 built and this file could reach for — would be
 * a control that LOOKS like it changes what you see and does not, which is
 * exactly the fake affordance `docs/design/04-role-pain-map.md` warns a
 * dashboard screen must not become for a role whose trust is not yet earned.
 * So with one membership this is plain text; with more than one, it is a
 * disabled control carrying its own explanation — the same "disabled, never
 * a dead control" rule `Sidebar.tsx` applies to the nav items below it.
 */
export function WorkspaceSwitch({
  memberships, className,
}: {
  memberships: Membership[];
  className?: string | undefined;
}) {
  const active = memberships[0];
  if (!active) return null;

  const extra = memberships.length - 1;

  return (
    <div
      className={cx(
        "flex items-center gap-2 rounded-control border border-line-subtle bg-surface px-2",
        "h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)",
        extra > 0 ? "text-ink-muted" : "text-ink",
        className,
      )}
      title={extra > 0 ? "Перемикання між робочими просторами ще не реалізовано." : undefined}
      aria-disabled={extra > 0 ? true : undefined}
    >
      <Building2 aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1 truncate text-data font-medium">{active.displayName}</span>
      {extra > 0 && (
        <>
          <span className="shrink-0 rounded-pill bg-subtle px-1.5 text-meta text-ink-muted">
            +{extra}
          </span>
          <ChevronsUpDown aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0 text-ink-muted" />
        </>
      )}
    </div>
  );
}
