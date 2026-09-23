import { Panel, PanelBody, PanelHeader } from "@goproceed/ui/components";


import { membershipRoleLabel, membershipStatusLabel } from "../../lib/membership-labels";
import type { Membership } from "../dash-shell/workspace-switch";

/**
 * `/settings/profile` — what the product actually knows about the person
 * signed in, and nothing it does not.
 *
 * NO EDITABLE FIELD, AND THAT IS A DECISION, NOT AN OMISSION. There is no
 * route that writes a display name, an avatar or an address: `/v1` has no
 * `PATCH /v1/me`, and the address itself lives in Supabase Auth, where
 * changing it means an email confirmation round trip this product has never
 * built. A disabled input, or a «Зберегти» that 404s, would be exactly the
 * fake affordance `04-role-pain-map.md` warns a screen must not become for a
 * role whose trust is not yet earned — the same rule `workspace-switch.tsx`
 * applies to itself.
 *
 * PRESENTATIONAL AND SERVER-SIDE. No `"use client"`: it renders text and takes
 * no interaction, so it ships no JavaScript. The only interactive thing on
 * this screen is the sign-out in the rail's `ProfileMenu`, which is its own
 * island.
 *
 * ITS OWN DOMAIN FOLDER (`src/components/profile/`), not `dash-shell/`, per
 * `docs/design/03-ui-references.md` §"The hierarchy": components are grouped
 * by domain, and this one belongs to the profile screen rather than to the
 * chrome that wraps every screen.
 */
export function ProfileView({
  accountLabel, memberships,
}: {
  /** Resolved by `session.service.ts`'s `accountLabel` — the address, or the
   * one Ukrainian sentence that stands in when the session carries none. */
  accountLabel: string;
  memberships: Membership[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <h1 className="text-h1 font-semibold text-ink">Профіль</h1>

      <Panel>
        <PanelHeader title="Обліковий запис" />
        <PanelBody>
          <dl className="flex flex-col gap-1">
            <dt className="text-meta text-ink-muted">Електронна пошта</dt>
            {/* `break-all`: an address has no break opportunity of its own, and
              * a long one on a 360px phone is exactly how a panel takes the
              * whole document's horizontal scroll with it — the defect
              * `qa/field.mjs`'s `measureHorizontalOverflow` was added for. */}
            <dd className="break-all text-data text-ink">{accountLabel}</dd>
          </dl>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Робочі простори" count={memberships.length} />
        {/*
          * ZERO MEMBERSHIPS IS REACHABLE ON THIS SCREEN, and only became so in
          * fix round 1: `dash-layout.tsx` used to swap the whole of `children`
          * for «Немає робочого простору» on every `/**` route, which meant
          * a brand-new account could not reach the one screen that tells them
          * which address they signed in as. That decision moved to
          * `app/(dash)/page.tsx`, so this panel now has to say the same thing for
          * itself rather than render an empty box under a count of 0. The
          * sentence is the catalogue's existing `dash.empty.no_workspace`, not
          * a second wording for the same fact.
          */}
        {memberships.length === 0 && (
          <PanelBody>
            <p className="text-data text-ink-muted">У вас ще немає робочого простору.</p>
          </PanelBody>
        )}
        <ul>
          {memberships.map((membership, i) => (
            <li
              key={membership.workspaceId}
              className={
                // Border between rows only — the panel already draws the
                // outer one, and doubling it there produces a 2px line.
                i < memberships.length - 1
                  ? "flex flex-col gap-1 border-b border-line px-4 py-3"
                  : "flex flex-col gap-1 px-4 py-3"
              }
            >
              <span className="text-data font-medium text-ink">{membership.displayName}</span>
              {/*
                * ROLE AND STATUS AS WORDS, NEVER AS A COLOUR ALONE — §4.1's own
                * row ("a status shown only by colour → colour PLUS its `ui_uk`
                * label"). No `Chip` here: a chip's tone would be the only thing
                * distinguishing four statuses, and three of the four are
                * unreachable on this screen anyway (`api.me_context` filters
                * `status = 'active'`), so the tone map would be decoration
                * carrying a maintenance cost. `membership-labels.ts` is where
                * the words come from, and D4's members screen — where all four
                * statuses DO appear — reuses it.
                */}
              <span className="text-meta text-ink-muted">
                {membershipRoleLabel(membership.role)}
                {" · "}
                {membershipStatusLabel(membership.status)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
