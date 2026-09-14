# GoProceed backlog

Open and deferred work, one entry each. The coordinator writes this file; specialist roles propose entries in their handoffs. [README.md](README.md) «Observation layers» places it: planning only, never evidence that something works. What is merged and verified is in [STATUS.md](STATUS.md).

**Where it came from.** [DEV-005](tasks/DEV-005-backlog-triage.md) triaged `TODOS.md` and the three `HANDOFF*.md` files at `main` `5480d2e` on 2026-09-14; `TODOS.md` was last changed in `bd08da9`. Every open item became an entry here. Closed items stay closed in those files, and the record's inventory says where each heading went. Two closed entries are kept at the end because live code cites them by `TODOS.md` line number.

**Evidence** lines were re-observed on 2026-09-14 at `5480d2e` unless they carry another date. Line numbers rot: re-locate by the quoted string.

## How an entry reads

`<a id="bl-NNN"></a>` on its own line, then `### BL-NNN — P0…P3 — title`, followed by:

- **State**, one of:
  - `open`;
  - `scheduled → DEV-NNN`;
  - `deferred (owner)`: only the owner can move it (a decision, a purchase, an account, a device), or the owner deferred it. No agent starts it;
  - `closed → <commit, DEV-NNN or owner-reported (YYYY-MM-DD)>`;
  - `wontfix (owner)`.
- **Legacy cite:** the exact phrase, on one line of `TODOS.md` or a `HANDOFF*.md` file, that the entry came from. `grep -F` on that phrase finds the source of an old `TODOS.md:<n>` citation.
- **Why**, **Evidence**, **Depends on**, **Deadline**.
- A `deferred (owner)` entry adds **Resume:** what the owner supplies and what happens next.

A priority is the source entry's own where it had one. Entries whose source carried none say «ranked by DEV-005»; the owner confirmed those rankings on 2026-09-14.

**Adding and closing.** Take the next unused number and never reuse one. A task that takes an entry sets `scheduled → DEV-NNN`; closing sets `closed →` and keeps the entry.

## Index

<!-- index:start -->
| Entry | P | State | Title |
|---|---|---|---|
| [BL-001](#bl-001) | P1 | deferred (owner) | The field-client parity gate: two physical phones |
| [BL-002](#bl-002) | P2 | deferred (owner) | The pilot-device inventory does not exist |
| [BL-003](#bl-003) | P1 | deferred (owner) | Market validation has no evidence, and no real customer document exists |
| [BL-004](#bl-004) | P2 | deferred (owner) | Product domain: hostnames, the email sending domain and the link host |
| [BL-005](#bl-005) | P2 | deferred (owner) | Retention durations are NULL, so 0081's retention job deletes nothing |
| [BL-006](#bl-006) | P3 | deferred (owner) | The evidence quota and the blocked-content retention figure are placeholders |
| [BL-007](#bl-007) | P3 | deferred (owner) | No decision on which milestone owns the field client's reference image |
| [BL-008](#bl-008) | P3 | deferred (owner) | The unsaved-photo banner reads as a failure while the upload is still in flight |
| [BL-009](#bl-009) | P2 | deferred (owner) | A repeat Telegram erasure after the subject re-links is refused |
| [BL-010](#bl-010) | P2 | deferred (owner) | The staging verification steps §6.1–§6.8 have no recorded run |
| [BL-011](#bl-011) | P3 | closed → owner-reported (2026-09-14) | The retired demo's Vercel project was left for the owner to remove |
| [BL-012](#bl-012) | P3 | deferred (owner) | The two headline measures have nowhere to be recorded |
| [BL-013](#bl-013) | P3 | open | `app.accept_invitation` ignores the invited email address |
| [BL-014](#bl-014) | P3 | open | A suspended or ended member can never be re-admitted |
| [BL-015](#bl-015) | P3 | open | Responsibility assignments can never be ended |
| [BL-016](#bl-016) | P3 | open | The own-party default has no writer, and party contacts lack the qualification-certificate columns |
| [BL-017](#bl-017) | P3 | open | `app.work_type_key_is_bindable` arm 2 is not scoped to a draft |
| [BL-018](#bl-018) | P3 | open | The lineage funding bound has no second bound over admitted allocations |
| [BL-019](#bl-019) | P3 | deferred (owner) | The service principal inherits the app role's table grants |
| [BL-020](#bl-020) | P3 | open | Any service-plane session can reproduce an erasure without the registry or the audit row |
| [BL-021](#bl-021) | P2 | open | A project access grant can be issued and never taken back |
| [BL-022](#bl-022) | P2 | open | A hand-typed zero-priced line and an imported one store different provenance |
| [BL-023](#bl-023) | P2 | open | Nothing in `apps/app` is rate-limited, the external plane included |
| [BL-024](#bl-024) | P2 | open | Blockers before any environment enables the Telegram webhook |
| [BL-025](#bl-025) | P3 | open | Routes put English into `fieldErrors[].message`, and no rule says who owns that text |
| [BL-026](#bl-026) | P3 | open | Cancelled assignments still show in «Мої доручення» |
| [BL-027](#bl-027) | P3 | open | `technical/openapi/README.md` says the public plane never consumes a grant |
| [BL-028](#bl-028) | P3 | open | INV-090 is allocated, and two catalogs do not point at it |
| [BL-029](#bl-029) | P3 | open | Reading a statutory act requires the capability that composes and freezes one |
| [BL-030](#bl-030) | P2 | open | The evidence purge worker runs nowhere |
| [BL-031](#bl-031) | P2 | open | Purge claims are not fenced |
| [BL-032](#bl-032) | P2 | open | A deactivated member cannot abandon their own upload through the route |
| [BL-033](#bl-033) | P2 | open | `evidence-storage.ts` puts raw storage keys into error messages |
| [BL-034](#bl-034) | P2 | open | The evidence screen formats times in a hard-coded zone, not the workspace's |
| [BL-035](#bl-035) | P3 | open | `apps/app` has no application logging, so «never in the logs» cannot be asserted |
| [BL-036](#bl-036) | P3 | open | The evidence route discards `failedKeys`, so a storage outage is a silent HTTP 200 |
| [BL-037](#bl-037) | P3 | open | Evidence groups are labelled by, and ordered by, a bare occurrence UUID |
| [BL-038](#bl-038) | P3 | open | The evidence screen renders full-size originals |
| [BL-039](#bl-039) | P2 | open | The retention mechanism does not reach every table it claims |
| [BL-040](#bl-040) | P3 | open | No workspace closure procedure |
| [BL-041](#bl-041) | P2 | deferred (owner) | `apps/mobile` has had no visual pass under Daylight |
| [BL-042](#bl-042) | P3 | open | The install hint does not recognise an iPad in desktop-class mode |
| [BL-043](#bl-043) | P3 | open | «Мої доручення» can show a bare unit as a work item's subtitle |
| [BL-044](#bl-044) | P3 | open | The field client's routes load the shared Button's motion chunk |
| [BL-045](#bl-045) | P1 | deferred (owner) | Plan D slice D4: members and access |
| [BL-046](#bl-046) | P3 | deferred (owner) | No dashboard screen authors project-sourced requirements |
| [BL-047](#bl-047) | P2 | open | No container role means «a dialog», so `Dialog`'s default width is dead |
| [BL-048](#bl-048) | P2 | open | `Checkbox` is below the 44px touch floor |
| [BL-049](#bl-049) | P3 | open | `next=/dash` is hard-coded in the dashboard's session-expired redirects |
| [BL-050](#bl-050) | P3 | open | The dashboard browser pass has an unexplained menu-reopen race |
| [BL-051](#bl-051) | P3 | open | `DialogClose` hand-rolls its ghost and icon styling |
| [BL-052](#bl-052) | P3 | open | No test enforces «never put a control height behind a `data-[…]` variant» |
| [BL-053](#bl-053) | P3 | open | The dashboard rail's four nav items are disabled placeholders |
| [BL-054](#bl-054) | P3 | open | The assignments register scrolls sideways at narrow widths instead of rendering cards |
| [BL-055](#bl-055) | P3 | open | Final-review minors: tokens, tests and the brand pipeline |
| [BL-056](#bl-056) | P3 | open | Final-review minors: `packages/ui` |
| [BL-057](#bl-057) | P3 | open | The pilot form's rate limit is per instance and can evict the current caller |
| [BL-058](#bl-058) | P3 | open | Daylight landing residuals |
| [BL-059](#bl-059) | P3 | open | Final-review minors: `apps/landing` |
| [BL-060](#bl-060) | P3 | open | Final-review minors: documents and configuration |
| [BL-061](#bl-061) | P2 | open | vitest 3.2.4 → 4 |
| [BL-062](#bl-062) | P2 | open | Three TypeScript versions in one workspace |
| [BL-063](#bl-063) | P2 | open | `scripts/validate_package.py` is orphaned |
| [BL-064](#bl-064) | P2 | open | vertical-m1 steps 7 and 8 went red once and never again |
| [BL-065](#bl-065) | P2 | open | A page render costs about three auth round trips and two self-fetch hops |
| [BL-066](#bl-066) | P3 | open | `turbo-ignore` is deprecated |
| [BL-067](#bl-067) | P3 | open | CI's `apt-get` step has no timeout or retry |
| [BL-068](#bl-068) | P3 | open | `supabase/functions/outbox-drain` sits outside every workspace |
| [BL-069](#bl-069) | P3 | open | `apps/app` type-checks only the tests `src` or `app` imports |
| [BL-070](#bl-070) | P3 | open | `technical/schema.sql` reads as current truth |
| [BL-071](#bl-071) | P3 | open | Migration `0026` attributes a sentence to `0015`; no document corrects it |
| [BL-072](#bl-072) | P3 | open | `baseline-verification.md` still reads «Verified» and is still cited for test runs |
| [BL-073](#bl-073) | P3 | open | `readiness.ts` cites a bare `state-catalog.csv`, and two files share that name |
| [BL-074](#bl-074) | P3 | open | Two delivery documents still state stale migration counts and a render refusal |
| [BL-075](#bl-075) | P1 | closed → `a306ec2` (2026-08-10) | Valuation funding was first-come and never re-offered |
| [BL-076](#bl-076) | P0 | closed → `0a7c407` (2026-08-10) | The pool stranded once an over-removal parted quantity from money |
<!-- index:end -->

## Owner decisions and external actions

<a id="bl-001"></a>
### BL-001 — P1 — The field-client parity gate: two physical phones

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «Plan C — Expo-web field client to parity»; `HANDOFF-2026-08-27.md` «The field-client parity gate»
- **Why:** ADR-009 keeps `apps/app`'s PWA field pages deployed until the Expo-web client passes `infra/README-staging.md` §6.9 and ADR-007's two measurements (EXIF through SHA-256, the `capture` attribute) on one iPhone and one Android phone. No task may remove the PWA pages before that. A harness run or a laptop smoke test is evidence toward the gate, not the gate.
- **Evidence:** [STATUS.md](STATUS.md) «PWA field client» row: iPhone measurements from 2026-08-21, none from Android. Runbook §8.3.
- **Depends on:** BL-002.
- **Deadline:** none recorded.
- **Resume:** the owner runs §6.9 on both phones. The coordinator records the measurements in a DEV record and re-observes STATUS; only then may a task retire the PWA field pages.

<a id="bl-002"></a>
### BL-002 — P2 — The pilot-device inventory does not exist

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «the pilot-device inventory does not exist»
- **Why:** `docs/product/roadmap.md`, `scope-and-boundaries.md`, ADR-004 and ADR-007 require one supported iPhone and one lower-resource Android device, physical, confirming the iOS 16.4+ / Android 10+ floor. The M2 measurement table needs their model numbers and OS versions.
- **Evidence:** `docs/product/roadmap.md:376` «The pilot-device inventory still does not exist»; ADR-007 «What this decision does not remove».
- **Depends on:** nothing technical: a purchase.
- **Deadline:** none recorded.
- **Resume:** the owner names the two devices (model, OS version). The coordinator records them where the roadmap's entry evidence points.

<a id="bl-003"></a>
### BL-003 — P1 — Market validation has no evidence, and no real customer document exists

- **State:** deferred (owner)
- **Legacy cite:** `HANDOFF-2026-08-27.md` «One real sanitized кошторис or АВР»; `HANDOFF.md` «Market evidence — unchanged, and still the largest risk»
- **Why:** every handoff called this the largest risk. The assumptions are unvalidated, contract-baseline import was specified against zero real files, and M4's entry evidence (one signed акт на закриття прихованих робіт, sanitized) is absent. Ranked by DEV-005.
- **Evidence:** STATUS «Outreach» row: last evidenced send 2026-07-28; materials of 2026-08-23 and 2026-08-25 unsent; assumptions A-1 to A-8 unvalidated. `docs/delivery/version-0.1.md:152` («One real sanitized кошторис, АВР, or interim-works file … unfreezes it») and `:696` («Entry evidence still owed and still absent»).
- **Depends on:** BL-004 for the URL a send points at (runbook §10 Q-3).
- **Deadline:** none recorded.
- **Resume:** the owner sends, or asks one company for one sanitized document. Replies go to `docs/discovery/outreach-log.md`; a document goes through the import work ADR-006 decision 6 froze.

<a id="bl-004"></a>
### BL-004 — P2 — Product domain: hostnames, the email sending domain and the link host

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «Spawned, still open»; `TODOS.md` «has been chosen to replace»
- **Why:** every surface is on `*.vercel.app`, where no SPF or DKIM record can be added. OTP mail leaves through Brevo's `brevosend.com` fallback sender, which reads as phishing to a stranger, on a free tier with a daily cap. `{{APP_HOSTNAME}}` and `{{LANDING_HOSTNAME}}` are still tokens. The Universal/App Link files belong with `apps/mobile` in v0.3 and need a host. Ranked by DEV-005.
- **Evidence:** `infra/README-staging.md:906` (the `brevosend.com` fallback); `git ls-files | grep -E 'apple-app-site-association|assetlinks'` returns nothing; runbook §10 Q-3.
- **Depends on:** the owner's domain decision (Q-3).
- **Deadline:** before real rollout (the free-tier cap); no date recorded.
- **Resume:** the owner picks a domain. A DEV task then authenticates the sending domain in Brevo, renames the sender to «GoProceed», resolves the hostname tokens and the Auth Site URL. The well-known files wait for v0.3.

<a id="bl-005"></a>
### BL-005 — P2 — Retention durations are NULL, so 0081's retention job deletes nothing

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «retention durations are owed (0081 shipped inert)»
- **Why:** the three `app.retention_policy` classes (`customer_communication`, `customer_identity`, `operational_security`) carry `duration = NULL`. The nightly `communication-retention` job runs and affects zero rows. Until `operational_security` has a duration, a raw Telegram id outlives a request-driven erasure (BL-039).
- **Evidence:** `grep -ln apply_communication_retention supabase/migrations/*.sql` → only `0081`; `technical/data-retention-catalog.csv` communication rows read `duration_external_gate`; runbook §10 Q-4.
- **Depends on:** a duration per class from the owner and counsel (external gate V-003).
- **Deadline:** before any environment holds real communication data; no date recorded.
- **Resume:** the owner gives the durations. A migration sets them through the `gp-architect` and `gp-security` route.

<a id="bl-006"></a>
### BL-006 — P3 — The evidence quota and the blocked-content retention figure are placeholders

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «the two retention figures v0.1-M2-A had to choose are defaults, not policy»
- **Why:** `organizations.evidence_quota_bytes` is NULL (unlimited) and `blocked_content_retention_days` is 7. Both are external-gate values. Nothing can change them either: `organizations` has no UPDATE path, on purpose.
- **Evidence:** `supabase/migrations/0039_organizations_have_no_update_path.sql` header (a settings command adds a column-scoped grant, a policy and a capability together).
- **Depends on:** BL-005's retention schedule; a settings-command design.
- **Deadline:** none recorded.
- **Resume:** the owner gives the figures. A task designs the settings command through `gp-architect`.

<a id="bl-007"></a>
### BL-007 — P3 — No decision on which milestone owns the field client's reference image

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «Owed, not built: the reference image»
- **Why:** ADR-007 decision 4 names a reference image beside the acceptance criterion. It exists in no form, and the owner shipped without it on 2026-08-10. The documents disagree on its milestone. Ranked by DEV-005.
- **Evidence:** `docs/domain/glossary.md:126` («A v0.1-M2 exit gate»); `docs/product/competitive-landscape.md` places reference images later; `docs/delivery/version-0.1.md` mentions one only in the user outcome (`:61`), not in M2's exit gates.
- **Depends on:** an owner ruling.
- **Deadline:** none recorded.
- **Resume:** the owner rules on the milestone. The three documents are made to agree; if it is v0.1-M2, the image is sourced from a primary, verification-tagged origin, never invented.

<a id="bl-008"></a>
### BL-008 — P3 — The unsaved-photo banner reads as a failure while the upload is still in flight

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «banner reads as a failure while the upload is still in flight»
- **Why:** INV-081 requires the warning from the moment the original exists only in memory. Its present tense («GoProceed не зберіг це фото…») reads as an upload that already failed. The proposal is an in-flight wording plus the current text after a real failure, with the gate unchanged.
- **Evidence:** `apps/app/src/lib/capture/state.ts:184-185` holds one constant; `technical/copy-catalog.csv:292` has only `warning.capture.not_saved`.
- **Depends on:** the owner's wording for both strings.
- **Deadline:** none recorded.
- **Resume:** the owner supplies the strings. A UI task changes both clients' `state.ts` (the duplication contract), the copy catalog and both harnesses, with `gp-ui-reviewer` and `gp-mobile`.

<a id="bl-009"></a>
### BL-009 — P2 — A repeat Telegram erasure after the subject re-links is refused

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «A repeat erasure after the subject re-links is refused, not resolved»
- **Why:** the definer raises when one workspace holds both a surrogated link row and a new link row for the same raw id. The two options are collapsing the older row (losing its distinct erasure record) or per-subject surrogates (changing `app.telegram_erasures`' unique key).
- **Evidence:** `grep -ln erase_telegram_identity_internal supabase/migrations/*.sql` → only `0081`; `packages/testing/src/telegram-erasure.test.ts` §4 pins the refusal.
- **Depends on:** the owner's choice.
- **Deadline:** none recorded.
- **Resume:** the owner picks an option. A migration follows through `gp-architect` and `gp-security`.

<a id="bl-010"></a>
### BL-010 — P2 — The staging verification steps §6.1–§6.8 have no recorded run

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «What this closes is exactly the sentence in the heading»
- **Why:** the origin went live on 2026-08-19 without the owner's bearer-token checks: an Auth user, the idempotent bootstrap, cross-tenant isolation, one finalize through `SERVICE_DB_URL`. Runbook Q-13 asks where such a run is recorded. Ranked by DEV-005.
- **Evidence:** `infra/README-staging.md` §6 and `:1036`; runbook §10 Q-13.
- **Depends on:** the owner (the checks carry a bearer token).
- **Deadline:** none recorded.
- **Resume:** the owner runs §6.1–§6.8 against staging. The coordinator records the output in a DEV record and re-observes STATUS.

<a id="bl-011"></a>
### BL-011 — P3 — The retired demo's Vercel project was left for the owner to remove

- **State:** closed → owner-reported (2026-09-14)
- **Legacy cite:** `TODOS.md` «Left for the owner, outside the repository»
- **Why:** the project whose root directory is `apps/demo` failed every build after that directory was removed on 2026-08-20. Ranked by DEV-005.
- **Evidence:** the owner reported on 2026-09-14 that the project is deleted ([DEV-005](tasks/DEV-005-backlog-triage.md) «Owner decisions»). Until then no repository record settled it: `scripts/validate-canonical-docs.mjs:172` calls the demo's URL dead since 2026-08-20, which describes the deployment, not the project. The Vercel API was not queried.
- **Depends on:** —
- **Deadline:** —

<a id="bl-012"></a>
### BL-012 — P3 — The two headline measures have nowhere to be recorded

- **State:** deferred (owner)
- **Legacy cite:** `HANDOFF.md` «The two headline measures»
- **Why:** first-time acceptance rate and days-to-signature are defined over v0.2 objects. `docs/delivery/version-0.1.md` decides that no v0.1 operation computes them: the owner records both in the pilot record of ADR-006 decision 8. That record has no home (runbook Q-1). The handoff's «M6 cannot close without them» does not account for that ruling, which `version-0.1.md` already carried (added in `c2ca50d`, 2026-08-08). Ranked by DEV-005.
- **Evidence:** `docs/delivery/version-0.1.md:826-839` («Settled here»); runbook §10 Q-1.
- **Depends on:** Q-1.
- **Deadline:** none recorded.
- **Resume:** the owner decides where the pilot record lives; the measures are recorded there during the pilot.

## Database, RLS and grants

<a id="bl-013"></a>
### BL-013 — P3 — `app.accept_invitation` ignores the invited email address

- **State:** open
- **Legacy cite:** `TODOS.md` «`app.accept_invitation` ignores the invited email address»
- **Why:** any authenticated holder of the link can consume an invitation addressed to someone else. The email is modelled and uniquely indexed, so it looks authoritative while the token is a pure bearer credential. M5's external access faces the same bearer-versus-identity question.
- **Evidence:** only `0011_workspace_access_security.sql` defines the function; `:177` `where i.token_hash = p_token_hash and i.status = 'pending'`.
- **Depends on:** a product rule from the owner (matching on email breaks «forward the link to a colleague»).
- **Deadline:** none recorded.

<a id="bl-014"></a>
### BL-014 — P3 — A suspended or ended member can never be re-admitted

- **State:** open
- **Legacy cite:** `TODOS.md` «a suspended or ended member can never be re-admitted»
- **Why:** offboarding is one-way; a rehired foreman cannot get back in.
- **Evidence:** `0011:188-191`, the `ALREADY_MEMBER` guard, has no status filter; `apps/app/app/v1/workspaces/[workspaceId]/members/route.ts` exports only `GET`; no scope row reactivates a membership.
- **Depends on:** membership lifecycle commands, a governance decision with its own audit and capability.
- **Deadline:** none recorded.

<a id="bl-015"></a>
### BL-015 — P3 — Responsibility assignments can never be ended

- **State:** open
- **Legacy cite:** `TODOS.md` «responsibility assignments can never be ended»
- **Why:** the table is append-only and an open-ended assignment is permanent, so separation-of-duties warnings accumulate. A superseding-fact shape to copy exists since `0045`.
- **Evidence:** `apps/app/app/v1/projects/[projectId]/responsibilities/route.ts` exports only `POST`; `technical/openapi/scope-v0.1.csv` has only `project_responsibilities.assign`.
- **Depends on:** a decision on the closing command.
- **Deadline:** none recorded.

<a id="bl-016"></a>
### BL-016 — P3 — The own-party default has no writer, and party contacts lack the qualification-certificate columns

- **State:** open
- **Legacy cite:** `TODOS.md` «Still open and named»
- **Why:** `organizations.default_own_party_id` is a workspace default no command sets. The content rules, ADR-005 decision 10 and the glossary say the кваліфікаційний сертифікат lives on the participant record, which is false in the runtime. Ranked by DEV-005 (the source was a closed P1).
- **Evidence:** `default_own_party_id` appears only in `0010_workspace_access_module.sql` (the column and its foreign key); `party_contacts` is created at `0010:119` and never altered; the certificate columns exist only in `technical/database/schema-v0.1.sql`.
- **Depends on:** a schema decision (`gp-architect`).
- **Deadline:** none recorded.

<a id="bl-017"></a>
### BL-017 — P3 — `app.work_type_key_is_bindable` arm 2 is not scoped to a draft

- **State:** open
- **Legacy cite:** `TODOS.md` «`app.work_type_key_is_bindable` arm 2 is not scoped to a draft»
- **Why:** the SECURITY DEFINER resolver answers for any contract version in the caller's workspace, a bit `cvrb_select` withholds from a member without a project grant. Unreachable through v0.1 routes, because both callers pass the draft being written; a third, direct caller would widen it.
- **Evidence:** only `0050` defines the function (`grep -n "function app.work_type_key_is_bindable" supabase/migrations/*.sql`); `apps/app/tests/work-type-carrier.int.test.ts` already calls it directly.
- **Depends on:** a new migration (`create or replace`, arm 2 requiring `status = 'draft'`) plus a refusal case, through `gp-architect` and `gp-security`.
- **Deadline:** none recorded.

<a id="bl-018"></a>
### BL-018 — P3 — The lineage funding bound has no second bound over admitted allocations

- **State:** open
- **Legacy cite:** `TODOS.md` «the belt-and-braces half»
- **Why:** the route gate (`rootAdmitted && delta < 0n`) closed the P0 in code. The database backstop still bounds a lineage by what it performed, not by what was admitted. Ranked by DEV-005.
- **Evidence:** only `0048` defines `app.assert_funded_within_lineage`; `apps/app/app/v1/progress-entries/[entryId]/adjustments/route.ts:191`.
- **Depends on:** a cutoff for pre-ADR-008 rows whose `admitted_by_closure_id` is NULL.
- **Deadline:** none recorded.

<a id="bl-019"></a>
### BL-019 — P3 — The service principal inherits the app role's table grants

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «The residual, named rather than closed silently»
- **Why:** accepted and bounded on 2026-08-18: `goproceed_service` is `NOBYPASSRLS` and carries the actor, so its reach equals the member's. The grant surface still lets a service transaction reach rows only the command's own code keeps it from. The successor is per-workload `NOLOGIN` worker roles, which is v0.2 work. Ranked by DEV-005 (the source bullet carried no priority).
- **Evidence:** `docs/architecture/tenancy-and-security.md` «Workers»; the bound test in `packages/testing` `m2-service-principal`.
- **Depends on:** v0.2 worker deployment.
- **Deadline:** none recorded.
- **Resume:** when v0.2 plans its workers, a `gp-architect` design per workload.

<a id="bl-020"></a>
### BL-020 — P3 — Any service-plane session can reproduce an erasure without the registry or the audit row

- **State:** open
- **Legacy cite:** `TODOS.md` «Parked findings from the erasure slice, not fixed»
- **Why:** 0081's guard recognises the transformation's shape rather than the caller. Only the definer binds redaction, registry and audit into one transaction, and only the rejection path is tested. A design constraint for any future `/v1` route on the service plane, not a defect in 0081. Ranked by DEV-005.
- **Evidence:** the parked entry; `0081` is the only migration defining the erasure functions.
- **Depends on:** a future erasure or workspace-closure route (BL-040).
- **Deadline:** none recorded.

## API, contracts and catalogs

<a id="bl-021"></a>
### BL-021 — P2 — A project access grant can be issued and never taken back

- **State:** open
- **Legacy cite:** `TODOS.md` «a project access grant can be issued through the product and never taken back»
- **Why:** a mis-scoped grant cannot be corrected through the product; only a superuser UPDATE reverses it. The state is modelled (`revoked_at`, honoured by `requireProjectCapability`); the command is missing.
- **Evidence:** `apps/app/app/v1/projects/[projectId]/access-grants/route.ts` exports only `POST`; `scope-v0.1.csv` has only `project_access.grant`; `apps/app/qa/field.mjs:745` revokes with raw SQL.
- **Depends on:** a scope row first, then the route, through `gp-architect` and `gp-security`.
- **Deadline:** none recorded.

<a id="bl-022"></a>
### BL-022 — P2 — A hand-typed zero-priced line and an imported one store different provenance

- **State:** open
- **Legacy cite:** `TODOS.md` «a hand-typed zero-priced line and an imported one store different provenance»
- **Why:** ADR-006 decision 2 and M1's exit gate require a hand-typed line to be indistinguishable in provenance from an imported one. A zero price stores `price_basis = null` when typed and the basis when imported.
- **Evidence:** `apps/app/src/lib/manual-baseline.ts:253` `priceBasis: unitPrice === null ? null : pins.priceBasis,`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-023"></a>
### BL-023 — P2 — Nothing in `apps/app` is rate-limited, the external plane included

- **State:** open
- **Legacy cite:** `TODOS.md` «external-plane rate-limit gap is the standing item»
- **Why:** the review link now needs a click, but a scanner that clicks still burns a grant, and nothing throttles attempts. Ranked by DEV-005 (the source P1 closed in code).
- **Evidence:** `apps/app/app/external/exchange/route.ts:65-69` («this product has no rate limiter for any surface»).
- **Depends on:** a decision on where limiting lives (edge or application); shared with BL-024's Task 13.
- **Deadline:** none recorded.

<a id="bl-024"></a>
### BL-024 — P2 — Blockers before any environment enables the Telegram webhook

- **State:** open
- **Legacy cite:** `TODOS.md` «The webhook-enable blocker list loses this item»
- **Why:** ADR-011 decision 10 orders three blockers: the Task 13 edge rate limit, a scheduler for the channel's jobs route, and the real-group staging pass. The card's tag and source, the fourth, closed on 2026-09-09. Ranked by DEV-005.
- **Evidence:** STATUS «Telegram channel» row: `apps/app/vercel.json` has no crons, so `app/internal/telegram/jobs/route.ts` has no caller; `src/lib/telegram/ingress.ts` has no rate-limit code.
- **Depends on:** runbook Q-12 (the scheduler) and Q-17 (a real group, blocked by M0's real-data rule); BL-023.
- **Deadline:** before the webhook is set anywhere.

<a id="bl-025"></a>
### BL-025 — P3 — Routes put English into `fieldErrors[].message`, and no rule says who owns that text

- **State:** open
- **Legacy cite:** `TODOS.md` «about twenty-five routes put English into `fieldErrors[].message`»
- **Why:** the office form renders the field verbatim to a Ukrainian-speaking user. `command.ts` also maps zod's own English into it. Either every message is user copy (and zod is translated) or the field is machine-facing and forms map `path` to their own copy.
- **Evidence:** `apps/app/src/lib/command.ts:88` `message: i.message`; `grep -rn fieldErrors docs/architecture` finds nothing.
- **Depends on:** the boundary decision, recorded in `docs/architecture/` before a second form reads the field.
- **Deadline:** none recorded.

<a id="bl-026"></a>
### BL-026 — P3 — Cancelled assignments still show in «Мої доручення»

- **State:** open
- **Legacy cite:** `TODOS.md` «has no status filter; `cancelled` assignments still show»
- **Why:** the route returns a cancelled assignment like an active one, and both field clients render what it sends.
- **Evidence:** `apps/app/app/v1/projects/[projectId]/assignments/route.ts:52-53` filters on workspace, project and assignee only; neither `apps/app` nor `apps/mobile/src/lib/field/load-assignments.ts` filters.
- **Depends on:** the owner's choice of layer (route or both clients).
- **Deadline:** none recorded.

<a id="bl-027"></a>
### BL-027 — P3 — `technical/openapi/README.md` says the public plane never consumes a grant

- **State:** open
- **Legacy cite:** `TODOS.md` «contradicts `scope-v0.1.csv`»
- **Why:** `external.exchange` is a public-plane command that consumes a grant (INV-057). The README's exemption is right for another reason: the caller holds a bearer token and no session.
- **Evidence:** `technical/openapi/README.md:82` and `:98` («can never consume a grant»); `technical/openapi/scope-v0.1.csv:62`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-028"></a>
### BL-028 — P3 — INV-090 is allocated, and two catalogs do not point at it

- **State:** open
- **Legacy cite:** `TODOS.md` «INV-090 is allocated and two catalogs do not point at it»
- **Why:** an invariant nothing references is one no suite is keyed to.
- **Evidence:** `grep -c INV-090 technical/database/entity-catalog.csv technical/database/relationship-catalog.csv` → 0 and 0; the `work_items typed_as requirement_rule_versions` row cites `INV-072`, the disclosure half.
- **Depends on:** `gp-architect` (catalog change).
- **Deadline:** none recorded.

<a id="bl-029"></a>
### BL-029 — P3 — Reading a statutory act requires the capability that composes and freezes one

- **State:** open
- **Legacy cite:** `TODOS.md` «The successor is a `statutory_acts.view` capability»
- **Why:** accepted by the owner on 2026-08-18: no v0.1 persona needs read-only act access. The split costs a migration, since the vocabulary is pinned by a CHECK. Ranked by DEV-005.
- **Evidence:** `technical/permissions/capabilities.csv`, row `statutory_acts.compose` («Compose freeze read and render …»).
- **Depends on:** the first persona that must read an act without writing one.
- **Deadline:** with that persona.

## Evidence, storage, workers and retention

<a id="bl-030"></a>
### BL-030 — P2 — The evidence purge worker runs nowhere

- **State:** open
- **Legacy cite:** `TODOS.md` «the evidence purge worker still runs nowhere»
- **Why:** deleting bytes needs storage credentials, so `apps/app/src/lib/evidence-purge.ts` needs a runtime. Until it has one, INV-047's 24-hour guarantee is only demonstrated by tests, and a workspace with a quota eventually stops accepting uploads.
- **Evidence:** `apps/app/vercel.json` has no `crons`; `.github/workflows/` holds only `ci.yml`, with no schedule; `drainEvidencePurge` is called only from `tests/evidence-purge.int.test.ts` and `tests/vertical-m2a.int.test.ts`.
- **Depends on:** runbook Q-12 (what runs consumers).
- **Deadline:** before real evidence is stored.

<a id="bl-031"></a>
### BL-031 — P2 — Purge claims are not fenced

- **State:** open
- **Legacy cite:** `TODOS.md` «purge claims are not fenced»
- **Why:** a worker that stalls past the one-hour reclaim window and resumes can clear a newer worker's claim or spend its retry budget. Theoretical while one caller exists.
- **Evidence:** `claim_upload_purge` (`0027:63`) marks a timestamp only; `complete_upload_purge` (`0021:89`) and `fail_upload_purge` (`0024:47`) take only the intent id.
- **Depends on:** BL-030, so the fencing matches the chosen runner.
- **Deadline:** before a second worker instance runs.

<a id="bl-032"></a>
### BL-032 — P2 — A deactivated member cannot abandon their own upload through the route

- **State:** open
- **Legacy cite:** `TODOS.md` «a deactivated member cannot abandon their own upload through the route»
- **Why:** losing `evidence.record` orphans the bytes at once; losing the membership leaves them until the 24-hour intent TTL. INV-047 asks for prompt purge in both cases.
- **Evidence:** `apps/app/src/lib/evidence/finalize-upload-intent.ts:76` calls `requireActiveMembership` before any command runs.
- **Depends on:** a definer for the read, a second authorization path whose only caller is this case.
- **Deadline:** none recorded (bounded by the TTL).

<a id="bl-033"></a>
### BL-033 — P2 — `evidence-storage.ts` puts raw storage keys into error messages

- **State:** open
- **Legacy cite:** `TODOS.md` «puts raw storage keys into error messages»
- **Why:** these are bare `Error`s, so `toProblemResponse` logs them verbatim. `docs/architecture/files-and-storage.md` §Downloads says logs never record «the signed URL or raw storage key». The file is the house style a new helper copies.
- **Evidence:** `apps/app/src/lib/evidence-storage.ts:65`, `:78`, `:83`, `:102`, `:123` interpolate the key.
- **Depends on:** nothing.
- **Deadline:** none recorded; urgent once logging exists (BL-035).

<a id="bl-034"></a>
### BL-034 — P2 — The evidence screen formats times in a hard-coded zone, not the workspace's

- **State:** open
- **Legacy cite:** `TODOS.md` «against a hardcoded default zone, not the workspace's own»
- **Why:** correct while every workspace is `Europe/Kyiv`, silently wrong the day a second zone exists.
- **Evidence:** `apps/app/src/components/evidence/evidence-card.tsx:54` and `:90` (`WORKSPACE_TIMEZONE_DEFAULT`); the same default in `issue-review-link.tsx:70`; `packages/contracts/src/evidence.ts` carries no timezone; `organizations.timezone` exists since `0001`.
- **Depends on:** threading the column through the evidence response or the dashboard's context.
- **Deadline:** before a second timezone exists.

<a id="bl-035"></a>
### BL-035 — P3 — `apps/app` has no application logging, so «never in the logs» cannot be asserted

- **State:** open
- **Legacy cite:** `TODOS.md` «because there are no logs»
- **Why:** D1's leak test asserts no signed URL in audit, outbox or idempotency bodies, and cannot assert the log half of the rule. Whether Vercel's access log records query strings was not established. This entry is what `apps/app/tests/evidence-read.int.test.ts` cites as `TODOS.md:783`.
- **Evidence:** the only non-test `console` call is `apps/app/src/lib/http.ts:97`; no `instrumentation.ts` or `middleware.ts`; `next.config.ts` is empty.
- **Depends on:** a structured-logging decision.
- **Deadline:** none recorded.

<a id="bl-036"></a>
### BL-036 — P3 — The evidence route discards `failedKeys`, so a storage outage is a silent HTTP 200

- **State:** open
- **Legacy cite:** `TODOS.md` «the evidence route discards `failedKeys`»
- **Why:** one purged object and an unreachable store render the same screen, and an operator cannot tell them apart.
- **Evidence:** `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts:116` `const { urls } = await createSignedReadUrls(keys, bucket);`.
- **Depends on:** BL-035, or a partial-failure field in the contract.
- **Deadline:** none recorded.

<a id="bl-037"></a>
### BL-037 — P3 — Evidence groups are labelled by, and ordered by, a bare occurrence UUID

- **State:** open
- **Legacy cite:** `TODOS.md` «the evidence screen's occurrence groups come back in UUID order»; `TODOS.md` «group with its bare UUID, not a human-readable requirement description»
- **Why:** a ПТВ tells sections apart by 36-character ids, in an order that changes when a requirement is added. The ordinal and the criterion text exist on another endpoint.
- **Evidence:** the group in `packages/contracts/src/evidence.ts` is `{ occurrenceId, evidence }`; the route orders by `ui.requirement_occurrence_id`; `apps/app/src/components/evidence/evidence-by-occurrence.tsx` renders «Вимога» and the id.
- **Depends on:** a contract extension (ordinal and label) or a second call; one change closes both halves.
- **Deadline:** none recorded.

<a id="bl-038"></a>
### BL-038 — P3 — The evidence screen renders full-size originals

- **State:** open
- **Legacy cite:** `TODOS.md` «originals, with no thumbnail pipeline»
- **Why:** a dozen full-resolution photos on one panel is slow. Resizing needs Supabase's paid image transformations (as recorded on 2026-08-22, not re-checked) or a derivative worker.
- **Evidence:** `apps/app/src/components/evidence/evidence-card.tsx:137-138`, a bare lazy `<img>` on `readUrl`.
- **Depends on:** evidence volume growing past one scroll; the current-docs rule before choosing.
- **Deadline:** none recorded.

<a id="bl-039"></a>
### BL-039 — P2 — The retention mechanism does not reach every table it claims

- **State:** open
- **Legacy cite:** `TODOS.md` «Two tables carry no retention row at all»; `TODOS.md` «The raw Telegram id survives in two intent tables»; `TODOS.md` «rows for five tables claimed a»
- **Why:** `telegram_requirement_choice_sessions` and `telegram_evidence_decision_tokens` have no retention row. Five tables' notes say the job has no branch reaching them. After an erasure, `consumed_by_telegram_user_id` in the binding and member-link intent tables keeps a raw id until `operational_security` has a duration.
- **Evidence:** neither table name appears in `technical/data-retention-catalog.csv`; the five rows say «has no branch that reaches this table yet»; `0081` is the only migration defining the job.
- **Depends on:** BL-005; a decision to extend the job or give those tables their own answer (`gp-architect`, `gp-security`).
- **Deadline:** before real Telegram data.

<a id="bl-040"></a>
### BL-040 — P3 — No workspace closure procedure

- **State:** open
- **Legacy cite:** `TODOS.md` «workspace closure procedure»
- **Why:** M0 gate 4 needs authorization, separation of duties, a dry-run inventory, an export offer, confirmation and a recorded outcome for a whole workspace. Only the identity-level erasure exists.
- **Evidence:** `docs/delivery/production-readiness.md:242` is unchecked; its 2026-09-03 evidence note says workspace closure is still owed.
- **Depends on:** runbook Q-11 (export); BL-020.
- **Deadline:** M0 gate 4.

## Field client and mobile

<a id="bl-041"></a>
### BL-041 — P2 — `apps/mobile` has had no visual pass under Daylight

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «visual pass of `apps/mobile` under Daylight»
- **Why:** its icons and colours moved with PR #71; its screens were not looked at. The owner decided on 2026-09-05 that the pass belongs to the proper Expo application.
- **Evidence:** `git log --oneline --since=2026-09-05 -- apps/mobile/src` returns nothing.
- **Depends on:** the Expo application's own scope.
- **Deadline:** none recorded.
- **Resume:** when the owner opens the Expo application's scope, a UI task with `gp-mobile` and `gp-ui-reviewer`.

<a id="bl-042"></a>
### BL-042 — P3 — The install hint does not recognise an iPad in desktop-class mode

- **State:** open
- **Legacy cite:** `TODOS.md` «the install hint does not recognise an iPad in desktop-class mode»
- **Why:** iPadOS Safari reports a Macintosh user agent by default, so a real iPad gets no hint. The pilot is two phones.
- **Evidence:** `apps/mobile/src/lib/install-hint.ts:81` keys on `/iPad|iPhone|iPod/`; no `maxTouchPoints` check anywhere under `apps`.
- **Depends on:** nothing (`gp-mobile`).
- **Deadline:** none recorded.

<a id="bl-043"></a>
### BL-043 — P3 — «Мої доручення» can show a bare unit as a work item's subtitle

- **State:** open
- **Legacy cite:** `TODOS.md` «subtitle at 390»
- **Why:** a work item with no work code renders its subtitle as the unit alone («м»).
- **Evidence:** `apps/app/src/lib/field/assignments.ts:148-150` joins `workCode` and `unitCode` with `filter(Boolean)`; quantity is not part of the line.
- **Depends on:** a copy decision on what the line carries.
- **Deadline:** none recorded.

<a id="bl-044"></a>
### BL-044 — P3 — The field client's routes load the shared Button's motion chunk

- **State:** open
- **Legacy cite:** `TODOS.md` «the field client's three routes now load the shared Button's `Press` (motion) chunk»
- **Why:** measured on 2026-09-05 at +339–373 KB of first-load JS and accepted then as the cost of one Button. Worth a non-motion path or a lazy `Press` if it matters on a site connection.
- **Evidence:** `packages/ui/src/components/Button.tsx:5` imports `Press`; `packages/ui/src/motion/Press.tsx` imports `motion/react`. The byte figure was not re-measured.
- **Depends on:** a field measurement that shows it matters.
- **Deadline:** none recorded.

## Dashboard and UI system

<a id="bl-045"></a>
### BL-045 — P1 — Plan D slice D4: members and access

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «D1–D4 remain, in the order the demand scan ranks the pain»
- **Why:** D0–D3 are merged. D4 needs an identity to show: `members.list` returns member id, user id, role and status, with no email and no name. The runbook cites the source as `TODOS.md:741-745` (`:279`, `:304`).
- **Evidence:** STATUS «Office dashboard» row; runbook §10 Q-15.
- **Depends on:** Q-15 (what identity the members screen shows, and whether it needs a new operation).
- **Deadline:** none recorded.
- **Resume:** the owner answers Q-15. The slice then follows `docs/design/02-building-ui.md`, with `gp-architect` if an operation is added.

<a id="bl-046"></a>
### BL-046 — P3 — No dashboard screen authors project-sourced requirements

- **State:** deferred (owner)
- **Legacy cite:** `TODOS.md` «The dashboard screen for requirement authoring was deliberately NOT built»
- **Why:** ADR-010 does not authorise it. A screen slice needs four things first: a dated ADR-009 amendment, a role-pain-map row, a browser command with an `Idempotency-Key`, and the full UI procedure. Ranked by DEV-005.
- **Evidence:** ADR-010 «What this decision does NOT authorise».
- **Depends on:** the owner's amendment of ADR-009.
- **Deadline:** none recorded.
- **Resume:** the owner approves the amendment; the four prerequisites are written before the screen slice starts.

<a id="bl-047"></a>
### BL-047 — P2 — No container role means «a dialog», so `Dialog`'s default width is dead

- **State:** open
- **Legacy cite:** `TODOS.md` «no container role means»
- **Why:** the theme clears the default container namespace, so `max-w-md` emits no CSS and every dialog is full width unless its caller overrides it. A trap for the next dialog; a missing role belongs in `tokens.json`.
- **Evidence:** `packages/tokens/src/tokens.json` container roles are `measure`, `content`, `nav`, `marketing`; `packages/ui/src/components/Dialog.tsx:49` `max-w-md`; `shell-error.tsx:10`, `no-projects-empty-state.tsx:11`, `no-workspace-empty-state.tsx:12` carry dead `max-w-*`.
- **Depends on:** a token-role decision (`docs/design/02-building-ui.md` §3.3).
- **Deadline:** none recorded.

<a id="bl-048"></a>
### BL-048 — P2 — `Checkbox` is below the 44px touch floor

- **State:** open
- **Legacy cite:** `TODOS.md` «`Checkbox` does not meet the 44px touch floor»
- **Why:** the harness refuses any dash screen that uses it at 390 or 360. The fix is a hit area larger than the paint, a design decision the first screen that reaches for it owes.
- **Evidence:** `packages/ui/src/components/Checkbox.tsx:33` `size-4` and its own comment at `:22`; no non-test use in `apps/app` yet.
- **Depends on:** the first dash screen that needs a checkbox.
- **Deadline:** with that screen.

<a id="bl-049"></a>
### BL-049 — P3 — `next=/dash` is hard-coded in the dashboard's session-expired redirects

- **State:** open
- **Legacy cite:** `TODOS.md` «is hardcoded in all three `session_expired` arms of»
- **Why:** a deep link is lost on re-authentication, but only in a same-request race the proxy does not catch. The fix edits the auth gate's cookie-rebuild path.
- **Evidence:** `apps/app/app/dash/layout.tsx:68`, `:76`, `:98`.
- **Depends on:** a `proxy.ts` change, which takes the `gp-architect` and `gp-security` route.
- **Deadline:** none recorded.

<a id="bl-050"></a>
### BL-050 — P3 — The dashboard browser pass has an unexplained menu-reopen race

- **State:** open
- **Legacy cite:** `TODOS.md` «the browser pass has an unexplained reopen race»
- **Why:** mitigated by waiting on observable conditions; the mechanism was never established. A candidate fix trades a verified accessibility path for an unproven race.
- **Evidence:** `apps/app/qa/field.mjs:3899` `settleAfterDialog`; no later record of a recurrence.
- **Depends on:** a recurrence with its diagnostic output.
- **Deadline:** none recorded.

<a id="bl-051"></a>
### BL-051 — P3 — `DialogClose` hand-rolls its ghost and icon styling

- **State:** open
- **Legacy cite:** `TODOS.md` «`DialogClose` hand-rolls its ghost+icon styling»
- **Why:** it does not compose `Button asChild`; `Button` has no icon size and forwards no ref. The kitchen-sink half of the source entry closed in `13157b9`.
- **Evidence:** `packages/ui/src/components/Dialog.tsx:57-65`.
- **Depends on:** a second control of the same kind.
- **Deadline:** none recorded.

<a id="bl-052"></a>
### BL-052 — P3 — No test enforces «never put a control height behind a `data-[…]` variant»

- **State:** open
- **Legacy cite:** `TODOS.md` «The general rule, which no test yet»
- **Why:** a `data-[…]` variant beats a `touch:` variant on specificity, and the 44px floor lost silently once (36px measured). Ranked by DEV-005 (the source paragraph carried no priority).
- **Evidence:** `git grep 'data-\[' -- packages/testing apps/app/qa` finds nothing.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-053"></a>
### BL-053 — P3 — The dashboard rail's four nav items are disabled placeholders

- **State:** open
- **Legacy cite:** `TODOS.md` «rail's four nav items read as disabled grey»
- **Why:** they were placeholders until slices D1–D4; D1–D3 have merged and none of the items is a link.
- **Evidence:** `apps/app/src/components/dash-shell/sidebar.tsx:120` sets `disabled` on every item of `NAV_ITEMS`.
- **Depends on:** a navigation decision for the merged routes.
- **Deadline:** none recorded.

<a id="bl-054"></a>
### BL-054 — P3 — The assignments register scrolls sideways at narrow widths instead of rendering cards

- **State:** open
- **Legacy cite:** `TODOS.md` «the assignments register is a horizontally-scrolling table at 390/360»
- **Why:** the design system's narrow-width rendering is cards; the register is a `DataTable` inside `overflow-x-auto`.
- **Evidence:** `apps/app/src/components/assignments/assignments-list.tsx:70` renders `DataTable`; no narrow-width card markup there or in `DataTable.tsx`.
- **Depends on:** a UI slice.
- **Deadline:** none recorded.

<a id="bl-055"></a>
### BL-055 — P3 — Final-review minors: tokens, tests and the brand pipeline

- **State:** open
- **Legacy cite:** `TODOS.md` «Foundation — tokens, tests, brand pipeline»; `TODOS.md` «From the re-review of the fix wave (2026-09-05)»
- **Why:** parked one line each from the Daylight whole-branch review, so none is silently dropped.
- **Evidence:** each line below was re-checked by a read-only pass on 2026-09-14; none of these was found fixed.
  - `packages/testing/src/palette-derivation.test.ts` header says no hex was typed by a human; most Daylight steps are picked hexes re-encoded.
  - `text-accent`'s «large text only» is documented, not enforced (`contrast.test.ts`).
  - The neutral ramp's warm-to-cool hue crossover between `-300` and `-400` is asserted nowhere.
  - `apps/app/public/icon.svg` and `safari-pinned-tab.svg` are copied by `scripts/generate-brand-icons.mjs` with no GENERATED header and no identity test.
  - `sharp` is pinned to `0.34.5` while `next` resolves `0.35.3`; the lock carries both.
  - `scripts/generate-brand-icons.mjs` has no package script.
  - No drift check on the icon outputs.
  - `apps/mobile/assets/android-icon-background.png` is generated and never read.
  - `green-500`, `amber-500` and `cobalt-50` are reachable from no semantic role, while the Daylight spec promises `green-500` for icons and dots.
  - `apps/mobile/assets/splash-icon.png` is rendered from the opaque maskable source; its field matches the splash background only by coincidence.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-056"></a>
### BL-056 — P3 — Final-review minors: `packages/ui`

- **State:** open
- **Legacy cite:** `TODOS.md` «`@utility beam` writes only `-webkit-mask`»
- **Why:** as BL-055.
- **Evidence:** re-checked on 2026-09-14; open unless marked.
  - `base.css` `@utility beam` writes only `-webkit-mask`.
  - `gp-beam 7s` is a literal where the marquee reads a duration token.
  - `FeatureCell`, `BentoCell` and `Step` hard-code `h3`; no `headingLevel`.
  - `Stepper` has no list semantics.
  - `CompareCard` is an unnamed `<article>` whose title is a `<p>`.
  - `FeatureGrid` reads `getBoundingClientRect()` on every `pointermove`.
  - `"use client"` also client-ifies `FeatureGrid`, which needs no handler.
  - `ScrollSettle` sets `perspective: 1500` inline.
  - `Compare.tsx` uses `var(--gp-border-strong)` inside an arbitrary class and types a `56px` grid column.
  - Docstrings: `ScrollSettle` still omits that a full-motion visitor below the fold sees flat, then tilts back. The `Stepper` half was fixed in `de5d3e0`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

## Landing

<a id="bl-057"></a>
### BL-057 — P3 — The pilot form's rate limit is per instance and can evict the current caller

- **State:** open
- **Legacy cite:** `TODOS.md` «the pilot form's rate limit is per serverless instance»; `TODOS.md` «the pilot rate limiter's current-request protection is not guaranteed by content»
- **Why:** the limit resets on a cold start; adequate at pilot scale. The bounded map's second eviction pass deletes by insertion order, and re-setting a tracked key does not move it, so a burst of spoofed `x-forwarded-for` values can evict a caller who just made a request.
- **Evidence:** `apps/landing/app/api/pilot/rate-limit.ts:14` (module-level `Map`), `:38`, `:45-49`.
- **Depends on:** a shared store, if the form is ever abused (`gp-security`).
- **Deadline:** none recorded.

<a id="bl-058"></a>
### BL-058 — P3 — Daylight landing residuals

- **State:** open
- **Legacy cite:** `TODOS.md` «Opened by the Daylight landing (2026-09-05)»
- **Why:** small, independent defects from the Daylight landing.
- **Evidence:**
  - `packages/ui/src/components/FeatureGrid.tsx:77` sizes `FeatureCell`'s icon box to the touch height (44px) where the prototype uses 36px.
  - `apps/landing/components/visuals/channel-app.tsx:16` badge «пілот» is a literal, not content.
  - `apps/landing/components/blocks/pilot-form.tsx:185` builds the failure mailto from raw `fields`; the clipboard text at `:82` uses the cleaned `checked.fields`.
  - `apps/landing/components/visuals/ui-capture.tsx:15` captions with a `span`, so `.landing-photo > figcaption` in `app/globals.css` never matches.
  - `apps/landing/tests/design-contract.test.tsx:21` still names the evidence-journey direction.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-059"></a>
### BL-059 — P3 — Final-review minors: `apps/landing`

- **State:** open
- **Legacy cite:** `TODOS.md` «Final review minors (2026-09-05)»
- **Why:** as BL-055. Six of the source lines were fixed by later work: the footer heading order and `board.tsx`'s `hidden md:grid` (`27cb783`); canonical and robots, the static `metadataBase`, and the whitespace-name focus (`607fe84`); the Border Beam probe window (`f254049`).
- **Evidence:** re-checked on 2026-09-14; open:
  - `nav.tsx` never clears `aria-current`.
  - `app/og/page.tsx` splits on `title.indexOf(titleAccent)` unguarded, and no content test asserts `title.includes(titleAccent)`.
  - `tests/pilot-route.test.ts` has no `405` assertion; `tests/landing-render.test.tsx` has no «no `aria-disabled`» assertion.
  - `turbo.json`'s `test` task omits the five pilot delivery variables the spec says it declares.
  - `app/api/pilot/route.ts` passes `referer` uncapped and uncleaned into a Telegram message (4096-character limit).
  - `deliver.ts` logs `String(r.reason)`, which for a transport rejection can carry a URL embedding the bot token.
  - `tests/landing-content.test.ts` forbidden words: substring checks miss inflections and will false-positive («кеп», «тов »); «польова вебпрограма» is an exact phrase; «електромонтаж» is checked against copy only.
  - `footer.tsx` compares an untyped `"mailto"` sentinel by string.
  - `qa/landing.mjs` kills `pnpm`, not `next start`, and sleeps four seconds instead of probing readiness.
  - `pilot-form.tsx` `form.reset()` leaves `fields` and `role` stale.
  - `app/globals.css` carries two stale comments (the file's purpose; a display face Daylight removed).
  - The QA harness has no accessibility (axe) pass.
  - `route.ts` reads `x-forwarded-for` element `[0]` while `rate-limit.ts` calls the header attacker-controlled; no shared helper.
  - A no-JavaScript submit lands on the handler's raw JSON problem (documented in `apps/landing/AGENTS.md`).
  - `access-matrix.tsx`'s sr-only `<caption>` repeats the visible `<h3>`.
  - `nav.tsx` `<li className="contents">` drops the listitem role in older Safari and Chromium.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-060"></a>
### BL-060 — P3 — Final-review minors: documents and configuration

- **State:** open
- **Legacy cite:** `TODOS.md` «Documents and configuration»
- **Why:** as BL-055. Fixed since: `03-ui-references.md` names each 21st.dev licence (`39f2640`); `apps/landing/AGENTS.md` documents the 500-key bound (`0c0a885`); `docs/design/01-tokens.md` no longer names the pilot form's radius.
- **Evidence:** re-checked on 2026-09-14; open:
  - `DESIGN.md` puts the pilot form on `card` (12px); the form ships `rounded-surface`.
  - `DESIGN.md` scopes `section` (16px) to the closing CTA card; two phone bezels use it correctly.
  - `DESIGN.md`'s `shadow-float` «reserved for» list omits three visuals that carry it.
  - `DESIGN.md` frontmatter gives `feature-cell` the container's border and radius, and omits `compare-card`'s border.
  - `docs/design/2026-08-19-design-system-rewrite-plan.md` still names Source Serif 4 and «fifteen» under a Status of Approved; it needs a living-or-historical decision (DEV-007's scope).
  - `design-references/visual-directions/README.md` says three directions; its superseded note cites a README path that does not exist.
  - `docs/design/03-ui-references.md` file header scopes it to `(dash)` though it carries a landing section.
  - `infra/README-staging.md` lists the five pilot variables without pairing them and says Production only.
  - `turbo.json` puts the five pilot secrets in `build.env`, so a token rotation invalidates every package's build cache.
  - An English dated correction sits in a Russian table row of `docs/superpowers/specs/2026-07-29-goproceed-baseline-zero-design.md` (frozen archive; cosmetic).
- **Depends on:** nothing; the rewrite-plan line joins DEV-007.
- **Deadline:** none recorded.

## Tooling, CI and dependencies

<a id="bl-061"></a>
### BL-061 — P2 — vitest 3.2.4 → 4

- **State:** open
- **Legacy cite:** `TODOS.md` «vitest 3.2.4 → 4.1.11»
- **Why:** v4 removes `vitest.workspace.ts` for `projects`. The serialized run (`--concurrency=1`, `fileParallelism: false`, the 10 s hook budget) keeps the shared local Postgres from deadlocking, so a change must be proved on a full serialized run.
- **Evidence:** every `package.json` that declares vitest pins `3.2.4`; `vitest.workspace.ts` exists. The target version is as of 2026-08-19; read the current docs first.
- **Depends on:** the current-docs rule; owner confirmation before any local database suite runs.
- **Deadline:** none recorded.

<a id="bl-062"></a>
### BL-062 — P2 — Three TypeScript versions in one workspace

- **State:** open
- **Legacy cite:** `TODOS.md` «TypeScript → 7.0.2 (the Go port)»
- **Why:** unify on one version before a 6.x or 7.x move; 5.9 → 6 is itself a config migration (`baseUrl`, `node10` resolution deprecations).
- **Evidence:** root `typescript` `5.9.2`, `packages/ui` `^5.9.3`, `apps/mobile` `6.0.3`.
- **Depends on:** the current-docs rule.
- **Deadline:** none recorded.

<a id="bl-063"></a>
### BL-063 — P2 — `scripts/validate_package.py` is orphaned

- **State:** open
- **Legacy cite:** `TODOS.md` «`scripts/validate_package.py` is orphaned: its subject was deleted»
- **Why:** about 2,400 lines that assert a deleted prototype; dead code that looks alive. Delete it and record what stopped being enforced, or retarget it at `apps/app` if its assertions still describe the product.
- **Evidence:** tracked (`git ls-files scripts/validate_package.py`); invoked by nothing, only described in `Makefile` and `ci.yml` comments.
- **Depends on:** a delete-or-retarget decision.
- **Deadline:** none recorded.

<a id="bl-064"></a>
### BL-064 — P2 — vertical-m1 steps 7 and 8 went red once and never again

- **State:** open
- **Legacy cite:** `TODOS.md` «vertical-m1 steps 7 and 8 went red once and would not do it again»
- **Why:** a real unexplained red in one full serialized run on 2026-08-10. The hypothesis to test first is cross-package residue from `@goproceed/testing` running before `apps/app`.
- **Evidence:** none since; CI history was not searched for a recurrence.
- **Depends on:** a recurrence: capture the assertion text before re-running.
- **Deadline:** none recorded.

<a id="bl-065"></a>
### BL-065 — P2 — A page render costs about three auth round trips and two self-fetch hops

- **State:** open
- **Legacy cite:** `TODOS.md` «a page render costs ~3 auth round trips and 2 self-fetch hops, by design»
- **Why:** measured on 2026-08-20 at 0.4–0.5 s warm. Two options, each an approved slice of its own: local JWT verification (`getClaims()`) per hop, or server components calling `src/lib` directly while keeping the single enforcement point some other way.
- **Evidence:** `apps/app/src/lib/auth.ts:26-27` and `apps/app/proxy.ts:86` call `auth.getUser()`; `apps/app/src/lib/api.ts:18` self-fetches.
- **Depends on:** the current-docs rule; `gp-architect` and `gp-security` (auth).
- **Deadline:** none recorded.

<a id="bl-066"></a>
### BL-066 — P3 — `turbo-ignore` is deprecated

- **State:** open
- **Legacy cite:** `TODOS.md` «`turbo-ignore` is deprecated»
- **Why:** Vercel has built-in skipping of unaffected projects. The replacement must keep `apps/app`'s Production-only guard and cover `apps/landing`, whose command allows previews.
- **Evidence:** `apps/app/vercel.json:7` and `apps/landing/vercel.json:6` run `npx turbo-ignore`.
- **Depends on:** the current Vercel docs.
- **Deadline:** none recorded.

<a id="bl-067"></a>
### BL-067 — P3 — CI's `apt-get` step has no timeout or retry

- **State:** open
- **Legacy cite:** `TODOS.md` «CI's `apt-get` step hung for 17 minutes once»
- **Why:** a runner-mirror hang once cost a whole run to the 20-minute job timeout.
- **Evidence:** `.github/workflows/ci.yml:337-340` («Install Chrome headless runtime libraries») runs bare `apt-get update` and `install`.
- **Depends on:** nothing (CI change: `gp-security` reviews action pins only if one changes).
- **Deadline:** none recorded.

<a id="bl-068"></a>
### BL-068 — P3 — `supabase/functions/outbox-drain` sits outside every workspace

- **State:** open
- **Legacy cite:** `TODOS.md` «`supabase/functions/outbox-drain` is outside every pnpm workspace»
- **Why:** its tests never run. Migration `0036` retired the function, so the choice is deleting the directory or recording it as a frozen record.
- **Evidence:** the directory holds `index.ts` and `drain.test.ts`; `pnpm-workspace.yaml` lists `apps/*`, `packages/*`, `discovery`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-069"></a>
### BL-069 — P3 — `apps/app` type-checks only the tests `src` or `app` imports

- **State:** open
- **Legacy cite:** `TODOS.md` «Test typechecking is narrower than its claim»
- **Why:** vitest transpiles tests without a full type check. Narrow the claim, or add a tests tsconfig. Ranked by DEV-005.
- **Evidence:** `apps/app/tsconfig.json` `include` is `src`, `app`, `next-env.d.ts`, `.next/types/**/*.ts`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

## Documentation and catalog corrections

<a id="bl-070"></a>
### BL-070 — P3 — `technical/schema.sql` reads as current truth

- **State:** open
- **Legacy cite:** `TODOS.md` «`technical/schema.sql` reads as current truth and is a design-time reference»
- **Why:** it is the design the migrations were derived from. Checking a column against it gives a confident wrong answer for tables that departed, `evidence_objects` first. The fix is a header, not a rewrite.
- **Evidence:** `technical/schema.sql:1` names itself an executable reference schema to convert into migrations; no line names `supabase/migrations/` as the runtime authority.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-071"></a>
### BL-071 — P3 — Migration `0026` attributes a sentence to `0015`; no document corrects it

- **State:** open
- **Legacy cite:** `TODOS.md` «attributes the external-gate sentence to migration»
- **Why:** a migration comment is history and cannot be edited, so the correction belongs in a document. The sentence is in `technical/database/schema-v0.1.sql`.
- **Evidence:** no correction found under `technical/`, `migration/`, `docs/architecture/` or `docs/decisions/`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-072"></a>
### BL-072 — P3 — `baseline-verification.md` still reads «Verified» and is still cited for test runs

- **State:** open
- **Legacy cite:** `TODOS.md` «is the upstream source of the stale»
- **Why:** the documents that link it for architecture now call it never updated. `README.md` and `docs/delivery/version-0.0.md` still cite it as the record of test runs.
- **Evidence:** `migration/goproceed-canonical-v0.1/baseline-verification.md:3` «**Status:** Verified with stated environmental limits»; `README.md:81`; `docs/delivery/version-0.0.md:18`, `:101`.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-073"></a>
### BL-073 — P3 — `readiness.ts` cites a bare `state-catalog.csv`, and two files share that name

- **State:** open
- **Legacy cite:** `TODOS.md` «`codeFor` comment cites a bare `state-catalog.csv`»
- **Why:** resolved to the legacy file, the citation points at package states and reads as unsourced. The copy in `blocked-reasons-list.tsx` was fixed; the original was out of that slice's remit.
- **Evidence:** `apps/app/src/lib/readiness.ts:464-465` («by state-catalog.csv:116's own definition»).
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-074"></a>
### BL-074 — P3 — Two delivery documents still state stale migration counts and a render refusal

- **State:** open
- **Legacy cite:** `TODOS.md` «Two counts elsewhere in the package still say ten»
- **Why:** both were stale when recorded on 2026-08-08. Acts render since 2026-08-10. Ranked by DEV-005 (the source note carried no priority).
- **Evidence:** `docs/delivery/version-0.1.md:207` («Ten of those fifty files have never»); `docs/delivery/production-readiness.md:150` («every one of the ten migrations») beside «No statutory act renders». STATUS «Open issues» lists the related hosted-migration disagreement.
- **Depends on:** nothing.
- **Deadline:** none recorded.

## Closed, kept for citations

<a id="bl-075"></a>
### BL-075 — P1 — Valuation funding was first-come and never re-offered

- **State:** closed → `a306ec2` (2026-08-10)
- **Legacy cite:** `TODOS.md` «valuation funding was first-come and was never re-offered»
- **Why:** kept because live code cites it as «the P1 at `TODOS.md:238`»: `apps/app/src/lib/admission.ts:502`, `apps/app/src/lib/valuation-writer.ts:310`, `apps/app/tests/admission-valuation.int.test.ts:511`. The owner decided on 2026-08-10 that admission is a standing claim.
- **Evidence:** `apps/app/tests/admission-valuation.int.test.ts` «the pool is offered again when the root that held it gives it back», added in `a306ec2`.
- **Depends on:** —
- **Deadline:** —

<a id="bl-076"></a>
### BL-076 — P0 — The pool stranded once an over-removal parted quantity from money

- **State:** closed → `0a7c407` (2026-08-10)
- **Legacy cite:** `TODOS.md` «the pool stranded once an over-removal parted quantity from money»
- **Why:** kept because live code cites it as «the P0 at `TODOS.md:585`»: `apps/app/src/lib/valuation-writer.ts:161`, `apps/app/tests/progress-adjust.int.test.ts:728`, `packages/domain/src/valuation.ts:234`. The carve denominator answers to the money.
- **Evidence:** `apps/app/tests/progress-adjust.int.test.ts` «the pool a line holds is the share its effective quantity bought», added in `0a7c407`.
- **Depends on:** —
- **Deadline:** —
