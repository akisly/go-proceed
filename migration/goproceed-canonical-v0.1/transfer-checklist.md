# Canonical transfer checklist

**Status:** Active

**Applies to:** documentation migration
**Last reviewed:** 2026-07-30

## Preservation

- [x] Create isolated `GoProceed` worktree.
- [x] Preserve Git history on `codex/goproceed-canonical`.
- [x] Leave the old tree unchanged.
- [x] Record old-tree modified and untracked paths in the source inventory.
- [x] Save the approved canonical design and implementation plan.
- [x] Preserve user-added `.agents` tooling and `skills-lock.json`.
- [x] Reconcile every old source to one final disposition
      (`document-disposition.csv`, 104 unique sources: 29 keep, 28 rewrite,
      7 merge, 25 defer, 13 archive, 2 delete_after_transfer pending user
      approval; old-tree uncommitted paths deferred to user review).

## Canonical authority

- [x] Create documentation index and source-of-truth hierarchy.
- [x] Create approved ADRs.
- [x] Rewrite product scope and roadmap.
- [x] Rewrite canonical domain model.
- [x] Rewrite architecture and security model.
- [x] Build target data/API/permissions/states/events catalogs
      (`technical/`, commit 9f3c333; 70 design relations, 51 operations).
- [x] Write delivery and discovery evidence
      (`docs/delivery/`, `docs/discovery/`, commit 6fed2df).

## Validation

- [ ] Validate required metadata.
- [ ] Validate relative links.
- [x] Validate technical CSV shape.
- [x] Validate one disposition per source.
- [ ] Check active GoProceed branding.
- [ ] Check prohibited placeholder language.
- [ ] Review spec coverage.
- [x] Record exact test baseline.

## Promotion

- [ ] Point root README to canonical documents.
- [ ] Mark legacy material non-normative.
- [ ] Produce cleanup proposal with exact paths.
- [ ] Confirm no unreviewed user work is selected for deletion.
- [ ] Obtain user approval before moving or deleting legacy sources.
- [ ] Begin v0.0 implementation only after documentation promotion.

## Current blockers

- Live database drift is unknown.
- Local Supabase and `APP_DB_URL` are unavailable in the worktree baseline.
- Three demo suites cannot resolve `@/lib/utils`.
- Build-script policy for esbuild, Puppeteer, and Sharp is undecided.
- Outreach evidence does not yet reconcile the founder-reported 50 sends with
  the workbook's 21 marked sends.
