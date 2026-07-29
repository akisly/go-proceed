# Approved decision register

**Status:** Approved input to canonical rewrite

**Applies to:** v0.0 and v0.1
**Last reviewed:** 2026-07-30

| ID | Approved | Decision | Rationale | Canonical document |
|---|---|---|---|---|
| D-001 | 2026-07-30 | Product name is GoProceed. | AktFlow naming is superseded. | `docs/product/vision-and-positioning.md` |
| D-002 | 2026-07-30 | Landing is a separate product surface and deployment. | Marketing must not be coupled to authenticated product runtime. | `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` |
| D-003 | 2026-07-30 | Durable demo lives in `apps/app` at `/demo`, not behind a query flag. | Prevent demo/tenant mixing and isolate data, auth, analytics, and caching. | `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` |
| D-004 | 2026-07-30 | Initial domains may use free Vercel domains. | Custom domains are not an early product gate. | `docs/product/roadmap.md` |
| D-005 | 2026-07-30 | Releases close sequentially by evidence, not hard dates. | Delivery speed may vary without silently changing scope. | `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` |
| D-006 | 2026-07-30 | v0.1 ends at protected partial external acceptance plus value at risk. | Full financial accounting was explicitly deferred. | `docs/decisions/ADR-001-product-boundary.md` |
| D-007 | 2026-07-30 | Full finance begins only after the acceptance boundary is validated. | Avoid premature accounting/statutory design. | `docs/decisions/ADR-001-product-boundary.md` |
| D-008 | 2026-07-30 | A workspace supports multiple own legal entities. | The customer may operate through several companies. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-009 | 2026-07-30 | A project may contain contracts of different own legal entities. | A construction object is not identical to one company. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-010 | 2026-07-30 | Own legal entity is selected on the contract, not fixed on the project. | Contract is the legal/commercial boundary. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-011 | 2026-07-30 | One package belongs to exactly one contract. | Party, currency, numbering, terms, and recipient scope remain unambiguous. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-012 | 2026-07-30 | Workspace display identity is separate from official legal-party data. | Avoid duplicate and drifting legal name/registration data. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-013 | 2026-07-30 | Workspace roles are owner, admin, member, and auditor. | Governance must not encode job titles. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-014 | 2026-07-30 | Project responsibilities are separate, composable assignments. | Performer, recorder, custodian, compiler, verifier, and submitter are distinct facts. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-015 | 2026-07-30 | One person may combine responsibilities in v0.1 with visible audit exception. | Small teams and founder-assisted pilots must remain usable. | `docs/decisions/ADR-002-tenancy-parties-and-contracts.md` |
| D-016 | 2026-07-30 | External reviewer is not a workspace member. | Access is capability-scoped to a package version. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-017 | 2026-07-30 | External access uses a personal bearer email link without OTP or required account. | Reduce friction while honestly limiting assurance. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-018 | 2026-07-30 | Bearer link exchanges through explicit POST into a protected external session. | Protect against link scanners, referrer leakage, stale grants, and CSRF. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-019 | 2026-07-30 | Link access proves possession of the link, not verified identity or qualified signature. | Same-channel access cannot establish legal identity. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-020 | 2026-07-30 | A contract may require multiple parallel external approvers and observers. | Customer and technical supervision can have independent duties. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-021 | 2026-07-30 | External reviewers may submit decisions incrementally. | Unreviewed items remain pending rather than blocking completed decisions. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-022 | 2026-07-30 | A line may be partially accepted and partially returned by quantity. | Accurate acceptance and risk must not require artificial work-item duplication. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-023 | 2026-07-30 | Multi-approver quantity decisions target exact claim segments. | Aggregate quantities alone cannot prove approvers decided the same portion. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-024 | 2026-07-30 | Evidence decisions and quantity decisions are separate. | A document issue must not silently change money. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-025 | 2026-07-30 | Blocking evidence prevents new linked acceptance but does not reverse accepted value automatically. | Financial effect requires explicit quantity decision. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-026 | 2026-07-30 | Decisions remain attached to the exact reviewed package version. | Do not misrepresent a v1 decision as acceptance of v2. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-027 | 2026-07-30 | Unchanged prior acceptance is referenced, not copied, after scope-hash verification. | Preserve accepted work without fabricating a new decision. | `docs/decisions/ADR-003-evidence-packages-and-acceptance.md` |
| D-028 | 2026-07-30 | Readiness, current acceptance, and value at risk are derived projections. | Avoid competing mutable sources of truth. | `docs/domain/domain-model.md` |
| D-029 | 2026-07-30 | VaR is disjoint, grouped by currency, and has explicit tax/rounding rules. | Projects can span companies and currencies; hidden FX and double counting are forbidden. | `docs/domain/value-at-risk.md` |
| D-030 | 2026-07-30 | Over-contract or unpriced work is shown separately. | Never invent price or silently apply a contract rate. | `docs/domain/value-at-risk.md` |
| D-031 | 2026-07-30 | v0.1 supports controlled XLSX/CSV contract-baseline import. | Quantity, price, package, and VaR need a trusted baseline. | `docs/domain/domain-model.md` |
| D-032 | 2026-07-30 | Full estimator resource logic is out of v0.1. | GoProceed is not an AVK/estimating-system clone. | `docs/product/scope-and-boundaries.md` |
| D-033 | 2026-07-30 | PDF extraction is a reviewable draft only. | Extraction cannot silently become contract truth. | `docs/domain/domain-model.md` |
| D-034 | 2026-07-30 | AI is future assistive automation, not a source of contract or acceptance facts. | Human confirmation and provenance remain mandatory. | `docs/product/scope-and-boundaries.md` |
| D-035 | 2026-07-30 | Online mobile is included in v0.1. | Field capture is part of the closed-loop product. | `docs/product/roadmap.md` |
| D-036 | 2026-07-30 | Online upload retains the local original until confirmed server receipt. | A transient connection failure must not lose evidence. | `docs/domain/execution-and-evidence.md` |
| D-037 | 2026-07-30 | Full offline authorization, sync, conflict handling, and resumable upload are v0.3. | Keep v0.1 deliverable while preserving a real later boundary. | `docs/product/roadmap.md` |
| D-038 | 2026-07-30 | v0.1 is delivered through M1–M6 vertical milestones. | Reduce big-bang risk without changing the user-facing version. | `docs/delivery/version-0.1.md` |
| D-039 | 2026-07-30 | Minimal privacy, retention, export, deletion, and restore gates precede real pilot data. | Evidence, contacts, object locations, and telemetry already create obligations. | `docs/delivery/production-readiness.md` |
| D-040 | 2026-07-30 | New canonical work is built in the symbolic `canonical` GoProceed worktree. | Preserve old tree and Git history while creating a clean package. | `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` |
| D-041 | 2026-07-30 | Old files are not deleted before explicit disposition and transfer review. | Preserve user work and historical evidence. | `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` |
| D-042 | 2026-07-30 | The lead workbook is evidence for 50 mapped leads and 21 marked sends, not proof of 50 sends or product demand. | Keep discovery claims auditable. | `docs/discovery/outreach-log.md` |
| D-043 | 2026-07-30 | v0.1 ships a separate online-only Expo/React Native field client in `apps/mobile` for iOS and Android; full offline extends it in v0.3. | Preserve the approved mobile-first field workflow without bringing offline authorization and sync into v0.1. | `docs/decisions/ADR-004-roadmap-demo-and-documentation.md` |
| D-044 | 2026-07-30 | v0.1 does not reverse quantity already accepted by all required external approvers; disputes remain visible and formal reversal/compensation is deferred. | Avoid inventing legal/commercial reversal authority inside the contract-to-acceptance pilot boundary. | `docs/domain/packages-and-acceptance.md` |
