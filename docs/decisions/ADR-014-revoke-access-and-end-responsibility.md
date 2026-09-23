# ADR-014: Revoking project access and ending a responsibility in v0.1-M1

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-09-23

**Related decisions:** [ADR-006](ADR-006-pilot-shaped-v0.1.md), [ADR-002](ADR-002-tenancy-parties-and-contracts.md), [ADR-012](ADR-012-invitation-revoke.md)

> **Authority.** Drafted by the coordinator of [DEV-043](../tasks/DEV-043-project-access-revoke.md)
> and [DEV-044](../tasks/DEV-044-responsibility-end.md) from their `gp-architect`
> design, and approved by the owner on 2026-09-23 (see «Approval» below). It adds
> two operations and one table to v0.1 under ADR-006 replacement rule 1. It
> changes none of ADR-006's decisions, and decision 4's list of 26 tables stays 26.

## Context

Migration `0010` built the workspace-access module: `project_access_grants`, an
explicit, time-bounded and revocable grant of one project capability to one
member, and `project_responsibility_assignments`, an append-only accountability
fact that never grants access (INV-021). v0.1 writes both
(`project_access.grant`, `project_responsibilities.assign`, both `v0.1-M1`), and
nothing takes either back:

- **A grant can be issued and never revoked (BL-021).** The revoked state is
  modelled — `revoked_at` is honoured by `requireProjectCapability` and
  `app.has_project_capability` — but no command sets it. A mis-scoped grant is
  corrected only by a superuser `UPDATE`, and the browser harness does exactly
  that (`apps/app/qa/field.mjs`).
- **A lapsed grant blocks its capability for good.** The grant route treats any
  unrevoked row as a duplicate, live or not, and the partial unique index
  `project_access_active_unique` (`0010`) refuses a second unrevoked row. A
  grant that ran out through `valid_until` therefore stops the same capability
  from ever being granted again to that member on that project.
- **An assignment can never be ended (BL-015).** The table is append-only
  (`0013`'s `project_responsibility_assignments_immutable`), and an open-ended
  assignment is permanent, so the separation-of-duties warnings the assign
  route computes (ADR-002) accumulate.

ADR-006 decision 1 and replacement rule 1 say a capability does not enter v0.1
because it is catalogued. Replacement rule 1 asks which step it is necessary
for:

- **Steps 1 and 2** of the pilot: the ПТВ and the foreman must be given the
  right access to the right project, and a wrong grant, or a foreman who moved
  to another site, must be correctable without a database session.
- **M0, «fit to hold someone else's data»:** access that can be granted and
  never withdrawn is not access control.
- **Accountability:** a responsibility held by someone who has left the project
  keeps producing warnings, and nothing records that it ended.

## Decision

1. **`project_access.revoke`** — `POST /v1/projects/{projectId}/access-grants/revoke`,
   a `command` with a required `Idempotency-Key`, member plane, milestone
   `v0.1-M1`, governed by `project.admin` (the capability that governs the
   grant). The body mirrors the grant's: `{ memberId, capabilities[] }`. It
   sets `revoked_at` on the member's unrevoked grants of those capabilities on
   that project, in one statement, and returns the revoked grants' ids. It
   writes an audit record (`project_access.revoked`) and no outbox event.
   - **Addressing** is by member and capability, not by grant id: the grant's
     response lists only the rows it inserted, a project's creator receives no
     ids at all, and no route lists grants. A list route is not part of this
     decision.
   - **Any unrevoked grant is revocable**: live, lapsed through `valid_until`,
     or not yet valid. Revoking a lapsed grant is what frees its capability for
     a new grant.
   - **A capability the member does not hold unrevoked** is refused with 409
     `VERSION_CONFLICT`, naming the capabilities in `details.notHeld`, and
     nothing is written.
   - **The last administrator is kept.** A revoke that would leave the project
     with no live `project.admin` grant held by an active member — the actor's
     own included — is refused with 409 `PROJECT_FINAL_ADMIN`, a new error code,
     and nothing is written.
   - **Revoking `project.view` removes the member from the project**: it
     revokes every unrevoked grant the member holds there. This mirrors the
     grant's rule that any action capability adds `project.view`, and it keeps a
     member from holding an action capability on a project they cannot see.
   - The target member may have any membership status: a suspended member's
     grants come back to life on reinstatement, so they must be revocable.
   - An id the caller cannot see is 404, before any authority check; a member
     of the project without `project.admin` is 403.
2. **`project_responsibilities.end`** — `POST /v1/projects/{projectId}/responsibilities/end`,
   a `command` with a required `Idempotency-Key`, member plane, milestone
   `v0.1-M1`, governed by `project.admin`. The body is
   `{ memberId, responsibility }`. It ends, **at the moment of the command**,
   every assignment of that pair that is live or has not started yet (one that
   has not started is cancelled), by appending one end fact per assignment. No
   end date in the past or the future is accepted. When nothing qualifies, it is
   refused with 409 `VERSION_CONFLICT` and nothing is written. It writes an
   audit record (`project_responsibility.ended`) and no outbox event. The
   separation-of-duties warning of a later assign no longer counts an ended
   assignment.
3. **One new table, outside decision 4's list.**
   `project_responsibility_assignment_ends` is an append-only fact (one per
   assignment at most, pinned to its assignment by a composite foreign key,
   `app.reject_mutation` refusing update and delete), in the workspace-access
   module with its parent. Neither `project_access_grants` nor
   `project_responsibility_assignments` is in decision 4's list of 26; they are
   the deployed module the list's M1 row does not count, and the new table is
   tagged `v0.1-M1` in the entity catalog in the same way. The list stays 26.
4. **The application role's write on grants narrows to the revoke.** A
   migration replaces `goproceed_app`'s table-wide `UPDATE` on
   `project_access_grants` with `UPDATE (revoked_at, version)`; no other column
   of a grant can change through the product.

## Consequences

- `v0.1-M1` goes from 36 to 38 operations and v0.1 from 76 to 78
  (`docs/delivery/version-0.1.md`).
- `technical/openapi/scope-v0.1.csv`, `technical/permissions/capabilities.csv`
  (`project.admin`), `technical/error-catalog.csv` (`PROJECT_FINAL_ADMIN`),
  `technical/database/invariant-catalog.csv`, `entity-catalog.csv`,
  `relationship-catalog.csv`, `rls-coverage.csv` and
  `technical/data-access-surface.csv` change with the routes.
- The browser harness's raw-SQL revoke stays SQL: it revokes a creator's only
  administrator grant, which the route refuses by decision 1.

## What this decision does NOT authorise

- A list or read route for grants or assignments, or any dashboard screen for
  them.
- Revoking or ending with a future or past date.
- Cascading a revoke to responsibilities (INV-021), to Telegram member links, to
  work assignments, or to external review links the member issued; those links
  stay live until `external_grants.revoke_reissue` retires them.
- Keeping a project administrable when its only administrator grant lapses
  through `valid_until` or its holder's membership is suspended (BL-014); the
  last-administrator rule covers revokes only.
- A trigger that makes `revoked_at` write-once or the other grant columns
  immutable; with the column grant, the product can still clear `revoked_at`
  through a defect.
- Membership lifecycle commands or re-admission (BL-014).

## Approval

**Approved by the owner on 2026-09-23, in conversation**, on the options the
coordinator put after the `gp-architect` design:

- «memberId + capabilities» — decision 1's operation and its addressing.
- «Отказ 409 PROJECT_FINAL_ADMIN» — decision 1's last-administrator refusal and
  its new code.
- «Каскад — убрать из проекта» — decision 1's `project.view` rule.
- «Строить сейчас: append-only таблица завершений» — decision 2's operation and
  decision 3's table.
- «Вне списка, как её родитель» — decision 3's place outside decision 4's list.
- «Только «сейчас»» — decision 2's end at the moment of the command.

The owner ruled on those options, not on this text. The remaining clauses are
the coordinator's and `gp-architect`'s detail of the approved options — the
409 `VERSION_CONFLICT` refusals and `details.notHeld`, revocability of lapsed
and future grants, any membership status for the target, 404 before 403, the
audit records and the absence of outbox events, and decision 4's column grant —
and the owner's merge ratifies them with the rest. The coordinator wrote this
section and the Status to transcribe the ruling (`docs/README.md` «ADR
lifecycle and approval»).
