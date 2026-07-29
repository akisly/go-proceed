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
- [ ] Reconcile every old source to one final disposition.

## Canonical authority

- [ ] Create documentation index and source-of-truth hierarchy.
- [ ] Create approved ADRs.
- [ ] Rewrite product scope and roadmap.
- [ ] Rewrite canonical domain model.
- [ ] Rewrite architecture and security model.
- [ ] Build target data/API/permissions/states/events catalogs.
- [ ] Write delivery and discovery evidence.

## Validation

- [ ] Validate required metadata.
- [ ] Validate relative links.
- [ ] Validate technical CSV shape.
- [ ] Validate one disposition per source.
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
