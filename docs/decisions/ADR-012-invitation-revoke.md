# ADR-012: Invitation revoke in v0.1-M1

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-09-18

**Related decisions:** [ADR-006](ADR-006-pilot-shaped-v0.1.md)

> **Authority.** Drafted by the coordinator of [DEV-021](../tasks/DEV-021-invitation-revoke.md)
> from its `gp-architect` design, and approved by the owner on 2026-09-18 (see
> «Approval» below). It adds one operation to v0.1 under ADR-006 replacement
> rule 1 and changes none of ADR-006's decisions.

## Context

Since [DEV-019](../tasks/DEV-019-invitation-token-at-rest.md) (BL-104) the
server keeps only an invitation token's hash: the token reaches the admin once,
in the response of the create that minted it, and a replay of that create
returns `kind: "replayed"` without it (INV-102). That was the right fix for a
bearer secret stored for thirty days, and it leaves two gaps (BL-107):

- **A lost token cannot be recovered.** Nothing withdraws the pending
  invitation, and `invitations_pending_email_unique` (migration `0010`) refuses a
  new invitation to the same address with 409 `VERSION_CONFLICT` until the
  pending one expires — 168 hours by default, 720 at most.
- **A mis-sent or leaked link cannot be killed.** The token is a pure bearer
  credential: `app.accept_invitation` does not check the invited email (BL-013),
  so whoever holds the link joins the workspace with the invited role until the
  invitation expires.

Neither command is in v0.1. `docs/README.md` makes `scope-v0.1.csv` the route
set, and ADR-006 decision 1 and replacement rule 1 say that a capability does
not enter v0.1 because it is already catalogued — the state and transition
catalogs describe the whole target design (`technical/states/README.md`), and
`technical/ui-actions.csv` A-009/A-010 are legacy catalog rows, not
implementation authority. Replacement rule 1 asks which step the capability is
necessary for:

- **Steps 1 and 2** of the pilot — the ПТВ and the foreman must be admitted to
  the workspace — and an invitation whose link was lost blocks that address for
  up to thirty days.
- **M0, «fit to hold someone else's data»**: a bearer link that cannot be
  withdrawn admits a stranger for up to thirty days.
- BL-107's own deadline: before invitations are sent from a hosted environment
  to real users.

## Decision

1. **`invitations.revoke`** — `POST /v1/invitations/{invitationId}/revoke`, a
   `command` with a required `Idempotency-Key`, member plane, milestone
   `v0.1-M1`, governed by `members.manage` (an owner or admin of the invitation's
   workspace, the same check `invitations.create` makes). It moves a **pending,
   unexpired** invitation to `revoked` (`technical/states/transition-catalog.csv`
   `pending → revoked`), after which its token admits no one. It returns no
   secret. An invitation that is accepted, revoked, expired, or pending past its
   `expires_at` is refused with 409 `VERSION_CONFLICT` and nothing is written.
   An id the caller cannot see is 404, before any authority check.
2. **The create's pending-address conflict names the blocking invitation.**
   `invitations.create`'s 409 `VERSION_CONFLICT` for an address with a pending
   invitation carries `details.invitationId`, so an owner or admin who lost the
   create response and its key can find the id to revoke. Recovery from a lost
   token is therefore revoke, then create.
3. **No table and no migration.** The `revoked` status, the `version` column and
   the owner/admin update policy (`inv_update`, `0014`) already exist; ADR-006
   decision 4's tables are unchanged. The revoke is recorded in the audit trail
   and the outbox (`invitation.revoked`), token-free and email-free.

## Consequences

- `v0.1-M1` goes from 35 to 36 operations and v0.1 from 75 to 76
  (`docs/delivery/version-0.1.md`).
- `technical/openapi/scope-v0.1.csv`, `technical/permissions/capabilities.csv`
  (`members.manage`), `technical/events/event-catalog.csv` and
  `technical/database/invariant-catalog.csv` (INV-103: an invitation's token
  admits only while the invitation is pending and unexpired) change with the
  route.
- A leaked link can be killed at once, which is the only mitigation of BL-013
  before expiry.

## What this decision does NOT authorise

- **Reissue.** Rotating an invitation's token in place was designed and not
  approved (owner, 2026-09-18); it is a backlog entry, and it would be a second
  route that mints a secret while BL-108 is open.
- An invitation list or register, and the S32 screen.
- Binding the token to the invited email (BL-013), membership lifecycle commands
  or re-admission (BL-014), email delivery, rate limits, the redemption page
  (BL-109), the generic secret guard (BL-108), or a transition-guard trigger on
  `public.invitations`.

## Approval

**Approved by the owner on 2026-09-18, in conversation**, on the options the
coordinator put after the `gp-architect` design:

- «Только revoke» — decisions 1 and 3; reissue not approved.
- «409 create несёт id» — decision 2.
- «409, ничего не писать» — decision 1's refusal of a pending invitation past its
  `expires_at`, with nothing written.

The coordinator wrote this section and the Status to transcribe that ruling
(`docs/README.md` «ADR lifecycle and approval»); the owner's merge of the pull
request that carries them ratifies the transcription.
