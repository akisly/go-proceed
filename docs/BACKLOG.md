# GoProceed backlog

Open and deferred work, one entry each. The coordinator writes this file; specialist roles propose entries in their handoffs. [README.md](README.md) «Observation layers» places it: planning only, never evidence that something works. What is merged and verified is in [STATUS.md](STATUS.md).

**Where it came from.** [DEV-005](tasks/DEV-005-backlog-triage.md) triaged `TODOS.md` and the three `HANDOFF*.md` files at `main` `5480d2e` on 2026-09-14; `TODOS.md` was last changed in `bd08da9`. Every open item became an entry here. Closed items stay closed in those files, and the record's inventory says where each heading went. Two closed entries are kept at the end because live code cites them; until DEV-006 re-pointed those citations to the entries, it cited them by `TODOS.md` line number.

**Evidence** lines were re-observed on 2026-09-14 at `5480d2e` unless they carry another date. Line numbers rot: re-locate by the quoted string.

## How an entry reads

`<a id="bl-NNN"></a>` on its own line, then `### BL-NNN — P0…P3 — title`, followed by:

- **State**, one of:
  - `open`;
  - `scheduled → DEV-NNN`;
  - `deferred (owner)`: only the owner can move it (a decision, a purchase, an account, a device), or the owner deferred it. No agent starts it;
  - `closed → <commit, DEV-NNN or owner-reported (YYYY-MM-DD)>`, a commit written as its hash in a code span;
  - `wontfix (owner)`.
- **Legacy cite:** the exact phrase, found on exactly one line of `TODOS.md` or a `HANDOFF*.md` file, that the entry came from, or `none` for an entry added after the triage. `grep -F` on that phrase finds the source of an old `TODOS.md:<n>` citation.
- **Why**, **Evidence**, **Depends on**, **Deadline**.
- A `deferred (owner)` entry adds **Resume:** what the owner supplies and what happens next.

A priority is the source entry's own where it had one. Entries whose source carried none say «ranked by DEV-005»; the owner confirmed those rankings on 2026-09-14. An entry added later names the task that ranked it («ranked by DEV-NNN»).

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
| [BL-075](#bl-075) | P1 | closed → `a306ec2` | Valuation funding was first-come and never re-offered |
| [BL-076](#bl-076) | P0 | closed → `0a7c407` | The pool stranded once an over-removal parted quantity from money |
| [BL-077](#bl-077) | P3 | open | Code and documents still send readers to the frozen `TODOS.md` by entry name |
| [BL-078](#bl-078) | P3 | open | The rewrite plan's rulings D1–D7 were never recorded in an ADR |
| [BL-079](#bl-079) | P1 | open | `outputs/` keeps personal data in git against the project's own rule |
| [BL-080](#bl-080) | P2 | deferred (owner) | Outreach routes and tender-title customers in `outputs/` are personal data the drafts treat as corporate |
| [BL-081](#bl-081) | P2 | open | Nothing stops a session from committing prospecting data again |
| [BL-082](#bl-082) | P2 | open | The landing is not yet rebuilt against its new reference |
| [BL-083](#bl-083) | P2 | open | Nothing keeps a package reached through pnpm's private hoist at one version |
| [BL-084](#bl-084) | P2 | open | The act footer names a «Реєстр будівельних норм» that ЗУ «Про будівельні норми» does not name |
| [BL-085](#bl-085) | P1 | closed → DEV-011 | `TELEGRAM_LINK_PEPPER` has no key id, so it cannot be rotated without losing data, and readiness gate 14 waits on it |
| [BL-086](#bl-086) | P3 | open | The HMAC key registry accepts a duplicate key id and the same secret in both key spaces |
| [BL-087](#bl-087) | P2 | open | A leaked Telegram erasure key still re-identifies the registry rows not yet moved to a newer key |
| [BL-088](#bl-088) | P2 | open | Uploaded images have no dimension, pixel-count or decoding-resource limit |
| [BL-089](#bl-089) | P2 | open | Office members open evidence inline from Storage with the uploader's content type, without `nosniff` or a sandbox |
| [BL-090](#bl-090) | P1 | closed → DEV-014 | 16 communication and Telegram registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-091](#bl-091) | P1 | closed → DEV-016 | 8 contract-baseline registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-092](#bl-092) | P1 | closed → DEV-016 | 4 evidence registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-093](#bl-093) | P1 | closed → DEV-016 | 3 execution registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-094](#bl-094) | P1 | closed → DEV-016 | 3 external-review registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-095](#bl-095) | P1 | closed → DEV-016 | 3 operational registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-096](#bl-096) | P1 | closed → DEV-015 | 2 projection registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-097](#bl-097) | P1 | closed → DEV-016 | 1 requirements registry row lacks tenant-isolation tests (readiness gate 11) |
| [BL-098](#bl-098) | P1 | closed → DEV-014 | 13 workspace-access registry rows lack tenant-isolation tests (readiness gate 11) |
| [BL-099](#bl-099) | P2 | open | A `covered` registry row requires only a cross-workspace read denial, not a write denial |
| [BL-100](#bl-100) | P1 | closed → DEV-015 | The service plane reads and rewrites every workspace's readiness projections, whatever workspace it declares |
| [BL-101](#bl-101) | P3 | open | A service transaction that keeps the caller's actor is not confined to the workspace it declares |
| [BL-102](#bl-102) | P1 | closed → DEV-017 | The service plane's capture-event insert ignores the workspace it declares, and its caller declares none |
| [BL-103](#bl-103) | P2 | closed → DEV-020 | A repeat of an idempotent command replays its stored response before membership is checked |
| [BL-104](#bl-104) | P1 | closed → DEV-019 | `invitations.create` stores the raw invitation token in `idempotency_records.response_body` for thirty days |
| [BL-105](#bl-105) | P3 | open | A capture event's work assignment is bound by nothing, so a defective service transaction could name another workspace's assignment |
| [BL-106](#bl-106) | P3 | open | `app.service_workspace()` has no pinned `search_path`, and more policies now rest on it |
| [BL-107](#bl-107) | P2 | closed → DEV-021 | A lost invitation cannot be revoked or reissued, so its address stays blocked until it expires |
| [BL-108](#bl-108) | P3 | open | `withIdempotency` stores any body its callback returns, secret or not |
| [BL-109](#bl-109) | P3 | open | The planned `invite/{token}` page would carry the invitation token in the URL path |
| [BL-110](#bl-110) | P3 | open | `app.delete_expired_idempotency` has a `public` search path, not an empty one |
| [BL-111](#bl-111) | P3 | open | An invitation cannot be reissued in place: recovery from a lost token is revoke, then create |
| [BL-112](#bl-112) | P2 | open | A command's request hash covers its body but not its path, so a key reused for another target replays the first target's result |
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
- **Legacy cite:** `HANDOFF.md` «**The two headline measures.**»
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
- **Note, 2026-09-18 (DEV-021):** since ADR-012 an owner or admin can revoke a pending invitation, which ends a leaked or forwarded link at once — the only mitigation before expiry. The token is still not bound to the invited email, and revoke helps only before acceptance: a stranger who already joined keeps the invited role, since no route ends a membership (BL-014).
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
- **Legacy cite:** `TODOS.md` «P3 — responsibility assignments can never be ended»
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
- **Depends on:** runbook Q-12 (the scheduler) and Q-17 (a real group, blocked by M0's real-data rule); BL-023; BL-085; and, added by DEV-010's security review, older production deployments deleted so none accepts an old webhook or worker secret (Deployment Protection was recorded as «Only Preview Deployments» on 2026-08-19, README-staging §5 step 4, not re-observed; Vercel documents its legacy pre-production mode as not protecting past production deployments, and a protection change without a custom domain may lock out the production alias; `infra/secret-rotation.md` «Telegram secrets»).
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
- **Legacy cite:** `TODOS.md` «puts raw storage keys into error messages, and they reach the console»
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
- **Why:** D1's leak test asserts no signed URL in audit, outbox or idempotency bodies, and cannot assert the log half of the rule. Whether Vercel's access log records query strings was not established. `apps/app/tests/evidence-read.int.test.ts` cites this entry (by a `TODOS.md` line number until DEV-006).
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
- **Why:** D0–D3 are merged. D4 needs an identity to show: `members.list` returns member id, user id, role and status, with no email and no name. The runbook cites this entry at `:279` and `:304` (by a `TODOS.md` line range until DEV-006).
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
- **Why:** they were placeholders until slices D1–D4; D1–D3 have merged and none of the items is a link. When they become links, two rulings from the removed `.interface-design/system.md` §5 apply, moved here by DEV-007: in the icon band (`rail-icons`, `md` to `wide`) the label stays in the DOM, so the accessible name never depends on a tooltip, which mounts only in that band; and the active item's bar is absolutely positioned, so the label does not shift as you navigate.
- **Evidence:** `apps/app/src/components/dash-shell/sidebar.tsx:120` sets `disabled` on every item of `NAV_ITEMS`.
- **Depends on:** a navigation decision for the merged routes.
- **Deadline:** none recorded.

<a id="bl-054"></a>
### BL-054 — P3 — The assignments register scrolls sideways at narrow widths instead of rendering cards

- **State:** open
- **Legacy cite:** `TODOS.md` «the assignments register is a horizontally-scrolling table at 390/360»
- **Why:** the design system's narrow-width rendering is cards; the register is a `DataTable` inside `overflow-x-auto`. The ruling behind it moved here from `.interface-design/system.md` §5 «WorkRegister» when DEV-007 removed that file: below `md` the register is a different hierarchy (cards that lead with money and state), not the table's DOM restyled, because changing `display` on table elements strips their implicit ARIA roles.
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
- **Why:** as BL-055. Fixed since: `03-ui-references.md` names each 21st.dev licence (`39f2640`); `apps/landing/AGENTS.md` documents the 500-key bound (`0c0a885`); `docs/design/01-tokens.md` no longer names the pilot form's radius; the rewrite plan, which still named Source Serif 4 and «fifteen» under a Status of Approved, is Historical (DEV-007).
- **Evidence:** re-checked on 2026-09-14; open:
  - `DESIGN.md` puts the pilot form on `card` (12px); the form ships `rounded-surface`.
  - `DESIGN.md` scopes `section` (16px) to the closing CTA card; two phone bezels use it correctly.
  - `DESIGN.md`'s `shadow-float` «reserved for» list omits three visuals that carry it.
  - `DESIGN.md` frontmatter gives `feature-cell` the container's border and radius, and omits `compare-card`'s border.
  - `design-references/visual-directions/README.md` says three directions; its superseded note cites a README path that does not exist.
  - `docs/design/03-ui-references.md` file header scopes it to `(dash)` though it carries a landing section.
  - `infra/README-staging.md` lists the five pilot variables without pairing them and says Production only.
  - `turbo.json` puts the five pilot secrets in `build.env`, so a token rotation invalidates every package's build cache.
  - An English dated correction sits in a Russian table row of `docs/superpowers/specs/2026-07-29-goproceed-baseline-zero-design.md` (frozen archive; cosmetic).
- **Depends on:** nothing.
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

<a id="bl-077"></a>
### BL-077 — P3 — Code and documents still send readers to the frozen `TODOS.md` by entry name

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-006 froze `TODOS.md` and the HANDOFF files and re-pointed every live `TODOS.md` line-number citation to an entry; the validator now refuses a new one. Prose pointers remain («recorded in `TODOS.md`», «the TODOS entry»). Each still resolves, through the entry whose Legacy cite quotes its source or to a closed item that stays history, but a reader has to search a 3,723-line frozen file to follow it. Ranked by DEV-006.
- **Evidence:** `git grep -n TODOS -- apps packages` lists 46 lines in 38 files after DEV-006, and listed 52 in 43 at `6fd98d0` before it re-pointed seven numbered citations in six files; one of those lines still names `TODOS.md`. Documents, `.github/workflows/ci.yml` and `infra/README-staging.md` add more; [DEV-005](tasks/DEV-005-backlog-triage.md) «What is not true after this task» names them.
- **Depends on:** nothing.
- **Deadline:** none recorded.

<a id="bl-078"></a>
### BL-078 — P3 — The rewrite plan's rulings D1–D7 were never recorded in an ADR

- **State:** open
- **Legacy cite:** none
- **Why:** `docs/design/02-building-ui.md` and the generated `docs/design/01-tokens.md` name D1–D7 in the rewrite plan's §3 as the rulings they enforce, «which need an ADR before Phase 3». §12's P0 required «Seven decisions recorded in an ADR»; none was written, and the surfaces since shipped on Daylight, which departed from D3's type pairing. DEV-007 made the plan Historical, so those rulings have no normative home. `02-building-ui.md` §3.1 and §7.3 no longer send readers into the plan; its Companions line and the generated `01-tokens.md` still name it as the reasoning. An ADR drafted as `Proposed` would record what was actually decided, for the owner to rule (`docs/README.md` «ADR lifecycle and approval»). Ranked by DEV-007.
- **Evidence:** `docs/design/2026-08-19-design-system-rewrite-plan.md` §3 and §12; `docs/decisions/README.md` indexes ADR-001 to ADR-011; the «Related decisions» lines of `02-building-ui.md` and `01-tokens.md` (the latter written by `packages/tokens/scripts/generate-docs.mjs`).
- **Depends on:** the owner's ruling on the drafted ADR.
- **Deadline:** none recorded.

<a id="bl-079"></a>
### BL-079 — P1 — `outputs/` keeps personal data in git against the project's own rule

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-007's `gp-security` review (S1-01, S1-02, S1-05) found personal data of natural persons in the prospecting session that commit `bbfc705` added: buyer-side contact persons in the raw ProZorro search dumps, and sole traders under their personal names with ten-digit identifiers, the length of a personal tax number rather than a company code. The project's rule, live through the `.gitignore` entries headed «personal data under ЗУ «Про захист персональних даних» (doc 40 §B.5)», keeps lead data out of git history and promises retention limits and deletion on request, which a tracked copy cannot honour without rewriting history. The repository is private and nothing deploys or uploads the directory, but every clone, worktree, CI checkout and agent session that reads it holds the data. The owner kept `outputs/` on 2026-09-13 as the prospecting record; this entry is the decision on how it is kept. Ranked by DEV-007 from the review's severity.
- **Evidence:** the coordinator's counts at `d8a860a` (2026-09-14): the five `outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d/prozorro_wave{3..7}_search_hits_2026-08-24.json` files hold 6,371 `contactPoint` objects, each with a name and an email (2,444 distinct name–email pairs); 9,788 `edrpou` values of ten digits across 52 files. `docs/legacy/40-phase1-discovery-outreach.md` §B.5; `.gitignore`'s Child B block. The review found no credentials.
- **Owner decision, 2026-09-15:** move the directory to private storage behind a pointer README; the data stays in `bbfc705` without a history rewrite ([DEV-012](tasks/DEV-012-m0-gate12-evidence.md) Owner decisions).
- **Depends on:** nothing further from the owner for the move; a history rewrite would be a separate decision.
- **Deadline:** none recorded.
- **Resume:** *(Superseded 2026-09-15 by the owner decision above.)* The owner chooses: keep the directory with a recorded purpose, lawful basis and retention date; move it to private storage behind a pointer README; or redact the personal fields in place. Moving or redacting leaves the data in `bbfc705` unless history is rewritten, a further owner decision (force-push, every clone re-made). The coordinator then opens a task for the chosen option, and BL-080 and BL-081 follow it.

<a id="bl-080"></a>
### BL-080 — P2 — Outreach routes and tender-title customers in `outputs/` are personal data the drafts treat as corporate

- **State:** deferred (owner)
- **Legacy cite:** none
- **Why:** DEV-007's review (S1-03, S1-04). The unsent A1-N01 outreach pack's own privacy rule promises general corporate addresses without employee names, yet most of its routes are free-mail addresses or mobile numbers, which for a small firm are often the director's own. Tender titles copied verbatim name private customers («Замовник: surname, initials») beside contract numbers and localities, with no bearing on any prospect. Ranked by DEV-007 from the review's severity.
- **Evidence:** `outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d/pilot_outreach_A1-N01_2026-08-25.md`: 7 recipient addresses, 6 on free-mail domains (coordinator's count); 101 «Замовник: <surname> <initial>.» matches in 22 files of the same directory (coordinator's count; the review counted 99 with its own pattern).
- **Depends on:** BL-079.
- **Deadline:** none recorded.
- **Resume:** with BL-079 decided, the owner chooses to keep, to redact the routes and the customer names, or to move the pack to the git-ignored `discovery/` store; the coordinator carries it out.

<a id="bl-081"></a>
### BL-081 — P2 — Nothing stops a session from committing prospecting data again

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-007's review (S1-09). Commit `bbfc705`, a landing layout change, added the whole session directory in passing, and no ignore rule or validator check would stop the next one. Two guards fit: ignore new session directories under `outputs/` while the existing tree stays tracked, and a validator check that refuses tracked files carrying ProZorro `contactPoint` objects outside approved paths. Ranked by DEV-007 from the review's severity.
- **Evidence:** `git log --format='%h %s' -- outputs` lists only `bbfc705` «fix(landing): adjust table borders for improved layout consistency»; `.gitignore` has no `outputs` entry.
- **Depends on:** BL-079, which decides what may stay tracked.
- **Deadline:** none recorded.

<a id="bl-082"></a>
### BL-082 — P2 — The landing is not yet rebuilt against its new reference

- **State:** open
- **Legacy cite:** none
- **Why:** on 2026-09-14 the owner kept the colours of `design-references/contest-2026-09/` and made https://parlo-black.vercel.app/ the landing's reference ([DEV-007](tasks/DEV-007-design-sources.md) «Owner decisions»). DEV-007 reads the decision as taking the landing's structure, composition and motion from the new reference while `DESIGN.md`'s Daylight colours stay; the slice's plan confirms that scope with the owner. The shipped landing reproduces the contest prototype, and live files rest on it: `DESIGN.md`, whose Don't list quotes the owner's «точь-в-точь» of 2026-09-06 and whose motion characteristics follow the parity spec; `docs/design/02-building-ui.md`'s read order (`:74`), its perpetual-loop and scroll-linked rules (`:185-191`, `:197-203`) and a motion trap (`:349`); `apps/landing/app/layout.tsx`'s parity note; and 31 rulings in `packages/tokens/src/tokens.json`, mirrored in the generated `docs/design/01-tokens.md`. Of those rulings, 11 are colour rulings the decision keeps; 20 cover type scale and tracking, radius, width, durations, springs, shadows and control heights, and are the slice's to revise. The slice is a UI change on the `02-building-ui.md` route with `gp-ui-reviewer`, and it amends `DESIGN.md` and the landing spec through the approval procedure before any code. The reference is reimplemented in token roles and `@goproceed/ui/motion`, copying no code, CSS or assets; its licence is unrecorded, so the slice records it as `03-ui-references.md`'s rows record theirs. Ranked by DEV-007.
- **Evidence:** the coordinator's browser observation on 2026-09-14: «Parlo — Autonomous Support Messaging», a dark page whose first screen is a perspective grid under a headline revealed word by word. `grep -c -i prototype packages/tokens/src/tokens.json` counts 31 lines. `design-references/README.md` records the new standings.
- **Depends on:** the owner's answers, in the slice's plan: (a) the perspective-grid first screen against `DESIGN.md`'s «Don't build a 3D scene»; (b) which ground, since the reference is dark and the Daylight colours sit on paper; (c) typography, which the decision does not mention (`DESIGN.md` sets Onest); (d) how closely to match, the previous reference having been matched «точь-в-точь»; (e) which scroll-linked compositions and loops replace those the parity spec names.
- **Deadline:** none recorded.

<a id="bl-083"></a>
### BL-083 — P2 — Nothing keeps a package reached through pnpm's private hoist at one version

- **State:** open
- **Legacy cite:** none
- **Why:** [DEV-008](tasks/DEV-008-types-react-dedupe.md) found that pnpm 9.12.0 privately hoists the copy of a package brought by whichever importer it lists first, and that order varies between runs. `next`, `lucide-react`, `framer-motion` and `@tanstack/*` import `@types/react` without declaring it, so when `apps/mobile` pinned a different `@types/react` the web programs sometimes loaded two copies and CI `typecheck` failed at random. DEV-008 aligned `@types/react`; nothing stops a hand pin, or an `expo install @types/react` that writes Expo's `~19.2.4` range, splitting it again. `react` and `react-dom` are already split (19.2.3 in `apps/mobile`, 19.2.8 in the web apps) and reach the same hoist. Two guards fit: root `pnpm.overrides` entries (and `pnpm-workspace.yaml` `overrides`, kept in sync as D-048 does for build scripts), or a check that fails when `pnpm-lock.yaml` holds more than one version of a package that web and mobile importers both reach, starting with `@types/react`, `@types/react-dom`, `react` and `react-dom`. Ranked by DEV-008.
- **Evidence:** DEV-008 «Progress and decisions» rows 1–3; at `5a38091` `grep -oE "@types/react@19\.[0-9.]+" pnpm-lock.yaml | sort -u` prints one version.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-084"></a>
### BL-084 — P2 — The act footer names a «Реєстр будівельних норм» that ЗУ «Про будівельні норми» does not name

- **State:** open
- **Legacy cite:** none
- **Why:** [DEV-009](tasks/DEV-009-m0-gate10-evidence.md)'s registry check found that ЗУ «Про будівельні норми» ст. 10 ч. 6 registers building norms «шляхом внесення запису до Єдиної державної електронної системи у сфері будівництва», and names no «Реєстр будівельних норм»; neither do the ЄДЕССБ pages read on 2026-09-14. Every printed act says «Перевірено за Реєстром будівельних норм: {дата}» (`pageFooterText()`), in wording fixed by the Approved `docs/product/hidden-works-content-rules.md` «Required disclaimers» and carried by ADR-005 and ADR-006. Separately, per `gp-researcher`'s summarised reading, not re-verified from the raw text: ПКМУ № 681 п. 6 names «Мінрозвитку» as the holder of ЄДЕССБ, and ПКМУ № 963 renamed that ministry from 18.07.2026, with the construction functions not yet allocated. A customer-facing regulatory sentence that names a body or register imprecisely is the class `hidden-works-content-rules.md` exists to prevent. Changing it is a content-rules change through the approval procedure, then `pageFooterText()` and its tests. The owner chose on 2026-09-14 to file it rather than widen DEV-009. Ranked by DEV-009.
- **Evidence:** `https://zakon.rada.gov.ua/laws/show/1704-17` (edition of 09.06.2022), ст. 10 ч. 6 and ст. 12, read 2026-09-14; `apps/app/src/lib/statutory-act-form.ts` `pageFooterText`; `technical/requirements/README.md` «What “the Реєстр будівельних норм” means here».
- **Depends on:** the owner's wording, and a reading of which ministry holds construction policy after ПКМУ № 963.
- **Deadline:** before a real customer receives a printed act (M6).

<a id="bl-085"></a>
### BL-085 — P1 — `TELEGRAM_LINK_PEPPER` has no key id, so it cannot be rotated without losing data, and readiness gate 14 waits on it

- **State:** closed → DEV-011
- **Legacy cite:** none
- **Why:** readiness gate 14 asks that HMAC verifier keys carry key ids. `TELEGRAM_LINK_PEPPER` keys the Telegram channel's link-token verifiers (`apps/app/src/lib/telegram/tokens.ts`, stored by the binding-intent and member-link-intent routes) and `subject_hmac` in `app.telegram_erasures` (migration `0081`; `apps/app/scripts/telegram-erase-identity.mjs`), with no key id. Replacing it invalidates unused link tokens and breaks the erasure registry's match, so a repeat request allocates a second surrogate and the re-link guard stops firing; a leaked pepper lets anyone holding the database re-identify erased people, and rotation does not repair that ([DEV-010](tasks/DEV-010-m0-gate14-evidence.md) review R1-01, security S1-06). On 2026-09-15 the owner chose to build a key-id pepper rather than close gate 14 with the limit. The work changes the erasure registry and its definer, so it takes the `gp-architect` and `gp-security` route. Ranked by DEV-010.
- **Evidence:** observed 2026-09-15 at `ccd1163`: `apps/app/src/lib/telegram/config.ts` (`TELEGRAM_LINK_PEPPER`, one value); `apps/app/src/lib/telegram/tokens.ts` `telegramVerifier`; `supabase/migrations/0081_the_identity_that_asked_to_be_forgotten.sql` `app.erase_telegram_identity_internal` finding a surrogate by `subject_hmac`.
- **Depends on:** none.
- **Deadline:** before the Telegram webhook is enabled anywhere (BL-024), and before readiness gate 14 closes.

<a id="bl-086"></a>
### BL-086 — P3 — The HMAC key registry accepts a duplicate key id and the same secret in both key spaces

- **State:** open
- **Legacy cite:** none
- **Why:** `apps/app/src/lib/external-link.ts` `loadRegistry` and the deploy preflight's copy of its rules (`apps/app/scripts/deploy-preflight-keys.mjs`) both accept `k1:<old>,k1:<new>`, where the last entry silently wins and every grant or session signed under the replaced `k1` stops verifying, and neither refuses the same secret in `EXTERNAL_LINK_HMAC_KEYS` and `EXTERNAL_SESSION_HMAC_KEYS`, which would merge the two key spaces. DEV-010 kept the two paths in parity and documented «never reuse a key id» in `infra/secret-rotation.md`; refusing both is a registry change. Ranked by DEV-010 (review R1-10, security S1-13).
- **Evidence:** observed 2026-09-15 at `ccd1163`: `apps/app/scripts/deploy-preflight-keys.test.mjs` case «a duplicate key id (both accept it; the last entry wins)».
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-087"></a>
### BL-087 — P2 — A leaked Telegram erasure key still re-identifies the registry rows not yet moved to a newer key

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-011 gave the erasure registry's HMAC keys key ids (migration `0085`). A repeat erasure request moves that person's row to the active key, but a row leaves an older key only when that person asks again. So a leaked older erasure key, with a copy of the database or any backup, still re-identifies every row under it. A wrapping scheme would store an HMAC of the old `subject_hmac` under the new key, with the key path, and compute the chain on lookup; a leaked older key would then not be enough on its own. The owner chose on 2026-09-15 to track this as its own entry, with the limit stated in `infra/secret-rotation.md`. Ranked by DEV-011.
- **Evidence:** observed 2026-09-15: `supabase/migrations/0085_the_key_that_named_itself.sql` header «WHAT THIS DOES NOT FIX»; `infra/secret-rotation.md` «Telegram link and erasure HMAC keys», «After a leak».
- **Depends on:** BL-085.
- **Deadline:** none recorded.

<a id="bl-088"></a>
### BL-088 — P2 — Uploaded images have no dimension, pixel-count or decoding-resource limit

- **State:** open
- **Legacy cite:** none
- **Why:** `docs/architecture/files-and-storage.md` «Content validation and malware boundary» (Approved) lists «image dimension/pixel-count and decoding-resource limits» among the controls applied before availability or parsing. The upload path limits bytes (the `evidence` bucket's `file_size_limit`, the per-workspace quota) and checks the type from magic bytes, but nothing bounds an image's dimensions or pixel count, so a small file that decodes to a very large bitmap is accepted as evidence. The exposure is present now: office members' and external reviewers' browsers decode evidence images as soon as a page shows them. A derivative or thumbnail worker, or an export, would add server-side exposure later. Readiness gate 12 names resource-exhaustion controls on uploads. Ranked by DEV-012.
- **Evidence:** observed 2026-09-15 at `48ba14e`: no dimension or pixel-count check in `apps/app/src/lib/evidence-inspection.ts`, nor anywhere under `apps/app/src/lib`, `apps/app/app` and `packages/domain/src`; [DEV-012](tasks/DEV-012-m0-gate12-evidence.md) row 2.
- **Depends on:** none.
- **Deadline:** before real customer data enters an environment (the browser path is live today), before any server-side image decoding ships, and before readiness gate 12 closes.

<a id="bl-089"></a>
### BL-089 — P2 — Office members open evidence inline from Storage with the uploader's content type, without `nosniff` or a sandbox

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-012's `gp-security` review (S1-01). The member plane reads evidence through Supabase Storage signed URLs created with no download option (`apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts:116`, `apps/app/src/lib/evidence-storage.ts` `createSignedReadUrls`), so a file is served inline from the Storage origin with the content type stored at upload, which whoever holds the signed upload URL sets on its PUT (the field client, or anyone holding that URL). On the Telegram path the stored type is the claimed type the inspection checked (`apps/app/src/lib/telegram/evidence.ts:199`, `:212`); Telegram's added risk is its less-trusted senders. Finalize checks the bytes against the claimed type from their leading bytes only, and the `evidence` bucket sets no `allowed_mime_types` (`0020`). The external review route already serves the detected type with `nosniff` and a sandbox CSP (`apps/app/app/external/evidence/route.ts:288-336`); the member plane has neither. The owner accepted this for the pilot on 2026-09-15 with revisit triggers (`docs/delivery/production-readiness.md` §12). The cheapest compensating controls are a download (`Content-Disposition: attachment`) on member signed URLs and storing the detected type as the object's content type. Ranked by DEV-012.
- **Evidence:** observed 2026-09-15 at `48ba14e` by `gp-security` (DEV-012 row 6); unverified: which response headers Supabase Storage sends on a signed read, and whether it serves an HTML or SVG content type as stored.
- **Depends on:** none.
- **Deadline:** before real customer data enters an environment, and before the Telegram webhook is enabled anywhere.

<a id="bl-090"></a>
### BL-090 — P1 — 16 communication and Telegram registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-014
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 16 relation–principal rows (11 relations) as `gap`: `public.communication_attachments` (goproceed_app): no member-plane policy test; only the external-session sweep in m5-external-rls.test.ts; `public.communication_attachments` (goproceed_service): no service-plane policy test; telegram-erasure.test.ts reaches it only through SECURITY DEFINER app.erase_telegram_identity; `public.communication_delivery_attempts` (goproceed_service): no test names the relation; no policy test; `public.communication_message_events` (goproceed_app): no member-plane policy test; only the external-session sweep in m5-external-rls.test.ts; `public.communication_message_events` (goproceed_service): no service-plane policy test; telegram-erasure.test.ts reaches it only through SECURITY DEFINER app.erase_telegram_identity; `public.communication_messages` (goproceed_app): no positive and no cross-workspace denial; telegram-rls.test.ts:42 is a same-workspace member without project.view and :49 an empty actor; `public.communication_messages` (goproceed_service): no service-plane policy test; telegram-erasure.test.ts reaches it only through SECURITY DEFINER app.erase_telegram_identity; `public.telegram_binding_intents` (goproceed_service): no service-plane policy test; telegram-erasure.test.ts reaches it only through SECURITY DEFINER functions; `public.telegram_chat_bindings` (goproceed_app): no member-plane policy test; only the external-session sweep in m5-external-rls.test.ts; `public.telegram_chat_bindings` (goproceed_service): no service-plane policy test; telegram-erasure.test.ts reaches it only through SECURITY DEFINER app.erase_telegram_identity; `public.telegram_media_groups` (goproceed_app): no member-plane policy test; only the external-session sweep in m5-external-rls.test.ts; `public.telegram_media_groups` (goproceed_service): no service-plane policy test; `public.telegram_member_link_intents` (goproceed_service): no service-plane policy test; telegram-erasure.test.ts reaches it only through SECURITY DEFINER functions; `public.telegram_member_links` (goproceed_service): no service-plane policy test; read only through SECURITY DEFINER app.resolve_telegram_linked_member (telegram-rls.test.ts:125) and the erasure functions; `public.telegram_requirement_choice_sessions` (goproceed_service): negative present (telegram-rls.test.ts:103 other workspace, :107 none declared); no positive: the declared-workspace case (:99) ends in a foreign-key refusal (23503), so no row of A is written or read; `public.telegram_requirement_choices` (goproceed_service): no test names the relation; no policy test. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 16 `gap` rows for module `communication` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-091"></a>
### BL-091 — P1 — 8 contract-baseline registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-016
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 8 relation–principal rows (8 relations) as `gap`: `public.contract_versions` (goproceed_app): immutability, grant and trigger checks only (m1-rls-baseline.test.ts:50,109,134); no policy test; `public.import_batches` (goproceed_app): only a same-workspace member without a project grant (m1-rls-baseline.test.ts:164); no positive and no cross-workspace read denial; `public.import_files` (goproceed_app): immutability check only (m1-rls-baseline.test.ts:68); no policy test; `public.import_row_results` (goproceed_app): grant-only check (m1-rls-baseline.test.ts:100); no policy test; `public.locations` (goproceed_app): schema tests only; no policy test; `public.source_amount_resolutions` (goproceed_app): grant-only check (m1-rls-baseline.test.ts:100); no policy test; `public.unit_definitions` (goproceed_app): schema tests only; no policy test; `public.work_items` (goproceed_app): grant and trigger checks only (m1-rls-baseline.test.ts:121,134); no policy test. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 8 `gap` rows for module `contract_baseline` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-016: the rows cite `packages/testing/src/*-rls.test.ts`, each file run alone and passing at `0086`.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-092"></a>
### BL-092 — P1 — 4 evidence registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-016
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 4 relation–principal rows (3 relations) as `gap`: `public.capture_events` (goproceed_app): same-workspace INSERT refusals and a permitted INSERT only (m2-policy-gaps.test.ts:84, m2-service-principal.test.ts:133); no read positive and no cross-workspace read denial while SELECT is held; `public.capture_events` (goproceed_service): reachable through goproceed_app with a policy naming goproceed_service; no service-plane test; `public.evidence_objects` (goproceed_app): no member-plane policy test; the read pair in m2-service-principal.test.ts:202 is service plane inside a nested describe; `public.upload_intents` (goproceed_app): same-workspace write refusals only (m2-binding-hardening.test.ts); no member-plane read positive and no cross-workspace read denial. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 4 `gap` rows for module `evidence` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-016: the rows cite `packages/testing/src/*-rls.test.ts`, each file run alone and passing at `0086`. The `capture_events` `goproceed_service` row did not close: its policy ignores the declared workspace, and it moved to BL-102.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-093"></a>
### BL-093 — P1 — 3 execution registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-016
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 3 relation–principal rows (3 relations) as `gap`: `public.progress_allocation_heads` (goproceed_app): grant-only check (m2-rls.test.ts:248); no policy test; `public.progress_entries` (goproceed_app): negative present (m2-rls.test.ts:72 cross-workspace read denial); no read positive, only an INSERT ... RETURNING in the actor's own workspace (m2-rls.test.ts:130) while SELECT is held; `public.valuation_allocations` (goproceed_app): negative only (m2-rls.test.ts:72 cross-workspace read denial); no positive. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 3 `gap` rows for module `execution` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-016: the rows cite `packages/testing/src/*-rls.test.ts`, each file run alone and passing at `0086`.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-094"></a>
### BL-094 — P1 — 3 external-review registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-016
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 3 relation–principal rows (3 relations) as `gap`: `public.external_access_grants` (goproceed_app): negative only (m5-external-schema.test.ts:872: a member of another workspace counts zero rows); no member-plane positive; `public.external_decision_batches` (goproceed_app): negative only (m5-external-schema.test.ts:872: a member of another workspace counts zero rows); no member-plane positive; `public.external_sessions` (goproceed_app): negative only (m5-external-schema.test.ts:872: a member of another workspace counts zero rows); no member-plane positive. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 3 `gap` rows for module `external_review` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-016: the rows cite `packages/testing/src/*-rls.test.ts`, each file run alone and passing at `0086`.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-095"></a>
### BL-095 — P1 — 3 operational registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-016
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 3 relation–principal rows (3 relations) as `gap`: `public.audit_events` (goproceed_app): the cited refused insert (foundation.test.ts:22) comes from an actor the test gives no membership, not a member of another workspace (gp-security S1-03); `public.idempotency_records` (goproceed_app): the only read pair (foundation.test.ts:69) uses an actor-scoped record with organization_id null; no workspace-A row and no cross-workspace member denial; `public.transaction_outbox` (goproceed_app): negative only (foundation.test.ts:59: foreign-org INSERT refused; INSERT is the only grant, 0003:64); no permitted INSERT into the actor's own workspace. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 3 `gap` rows for module `operational` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-016: the rows cite `packages/testing/src/*-rls.test.ts`, each file run alone and passing at `0086`.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-096"></a>
### BL-096 — P1 — 2 projection registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-015
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 2 relation–principal rows (2 relations) as `gap`: `public.blocked_reasons` (goproceed_service): positive only (m3-closure-rls.test.ts:593: asService writes the row of A); no refusal for another or no declared workspace; `public.readiness_projection` (goproceed_service): positive only (m3-closure-rls.test.ts:593: asService writes the row of A); no refusal for another or no declared workspace. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 2 `gap` rows for module `projection` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-015: both rows cite `packages/testing/src/projection-rls.test.ts`, passing at `0086` (`0086` applied to the local database only).
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-097"></a>
### BL-097 — P1 — 1 requirements registry row lacks tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-016
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 1 relation–principal rows (1 relation) as `gap`: `public.requirement_template_versions` (goproceed_app): immutability tests only (m2-rls.test.ts:185-244); no policy test. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 1 `gap` rows for module `requirements` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10. Closed 2026-09-17 by DEV-016: the rows cite `packages/testing/src/*-rls.test.ts`, each file run alone and passing at `0086`.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-098"></a>
### BL-098 — P1 — 13 workspace-access registry rows lack tenant-isolation tests (readiness gate 11)

- **State:** closed → DEV-014
- **Legacy cite:** none
- **Why:** readiness gate 11 closes only when every exposed tenant relation has a positive and a negative policy test (owner, 2026-09-15), and `technical/database/rls-coverage.csv` classifies these 13 relation–principal rows (13 relations) as `gap`: `api.me_context` (goproceed_app): negative only (rls.test.ts:29: a non-member reads zero rows); no positive reading the caller's own context; `public.invitations` (goproceed_app): exercised only through SECURITY DEFINER app.accept_invitation (m1-rls-workspace.test.ts:74); no policy test; `public.legal_entities` (goproceed_app): INSERT refusals only (rls.test.ts:58, foundation.test.ts:87) plus an owner INSERT ... RETURNING; no read positive and no cross-workspace read denial while SELECT is held; `public.memberships` (goproceed_app): positive only (m1-rls-workspace.test.ts:64: a member lists its workspace's memberships); no cross-workspace read denial, and the INSERT refusal at rls.test.ts:45 does not count while SELECT is held; `public.organizations` (goproceed_app): the cited negative (rls.test.ts:8) is a user with no membership, not a member of another workspace (gp-security S1-03); a policy with no workspace filter would pass it; `public.own_legal_entity_profiles` (goproceed_app): fixture rows only (m1-rls-baseline.test.ts); no policy test; `public.parties` (goproceed_app): negative only (m1-rls-workspace.test.ts:30: cross-workspace read denial); no positive read; `public.party_contacts` (goproceed_app): schema tests only; no policy test; `public.party_legal_profiles` (goproceed_app): fixture rows only (m1-rls-baseline.test.ts); no policy test; `public.project_access_grants` (goproceed_app): written by superuser fixtures only (the composite-FK case at m1-rls-workspace.test.ts:55 runs as superuser); no policy test; `public.project_field_channels` (goproceed_app): no member-plane policy test; telegram-rls.test.ts:185 is service plane and asserts no rows; `public.project_parties` (goproceed_app): schema tests only; no policy test; `public.project_responsibility_assignments` (goproceed_app): grant-only check (m1-rls-baseline.test.ts:100); no policy test. The v0.1 minimum per row is in `docs/delivery/test-strategy.md` §4 and the DEV-013 record: on the member plane an authorised same-workspace read (or, without `SELECT`, a write) and a read denial to an active member of another workspace; on the service plane the declared workspace reaching the row and another or no declared workspace refused. A test that closes a row is cited in the registry, which the validator then checks. Ranked by DEV-013.
- **Evidence:** observed 2026-09-16 at `b9dcf6b` against the local database at `0085`: the 13 `gap` rows for module `workspace_access` in `technical/database/rls-coverage.csv`; [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) rows 6–10.
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-099"></a>
### BL-099 — P2 — A `covered` registry row requires only a cross-workspace read denial, not a write denial

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-013's `gp-security` review (S1-04). The v0.1 minimum behind a `covered` row in `technical/database/rls-coverage.csv` is an authorised same-workspace read and a read denial to a member of another workspace. Where the principal also holds `INSERT` or `UPDATE`, nothing requires a cross-workspace write denial, so a policy whose `USING` clause is right and whose `WITH CHECK` is permissive can still be `covered`; on root tables no composite foreign key backstops it, and `packages/testing/src/m4-act-rls.test.ts` already treats a wrong-workspace write as the worse failure. Write denial stays review until the minimum is widened, which is the owner's call (whether it must hold before readiness gate 11 closes). Ranked by DEV-013.
- **Evidence:** observed 2026-09-16: `docs/delivery/test-strategy.md` §4 and `docs/architecture/tenancy-and-security.md` «Required security tests and gates» (the dated DEV-013 notes); [DEV-013](tasks/DEV-013-m0-gate11-coverage-checker.md) row 9.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-100"></a>
### BL-100 — P1 — The service plane reads and rewrites every workspace's readiness projections, whatever workspace it declares

- **State:** closed → DEV-015
- **Legacy cite:** none
- **Why:** found while scoping DEV-014. `br_write_server` and `rp_write_server` (`supabase/migrations/0045_the_refusal_and_the_facts_behind_it.sql:1649-1656`) are `for all to goproceed_service using (true) with check (true)` (the migration names the role by its name before `0057` renamed it) on `public.blocked_reasons` and `public.readiness_projection`. PostgreSQL applies an `ALL` policy to the selection side as well as the modification side, and permissive policies combine with `OR`; the service role holds `insert, update, delete` directly (`0045:1468-1469`) and `select` through `goproceed_app`. So a service transaction that declares another workspace, or none, can select, insert, update and delete every tenant's projection rows, and the migration's own comment (`0045:1643-1648`), which says the policy «adds only the write side», is wrong. The threat is not an outside caller: `app.service_workspace()` is a declaration the service code makes itself, and whoever holds the service credential can declare any workspace. What is missing is the fence against a defect in service code — a rebuild that forgets its scope would delete or rewrite every tenant's projections, and a read without a declaration would return all of them. The composite foreign key keeps a row's project inside its workspace, but it does not stop a cross-workspace read or rewrite. `technical/data-access-surface.csv` has no row for either table; the fix owes them. This is why the two `goproceed_service` registry rows of BL-096 cannot be `covered`: their negative (another or no declared workspace is refused) would fail. The owner decided on 2026-09-16 that the fix is a separate DEV task (`gp-architect`, a migration, `gp-security`), started with the failing test. Ranked by DEV-014.
- **Evidence:** observed 2026-09-16 at `35578e7` against the local database at `0085`: the four `pg_policies` rows of the two tables, kept as DEV-014 `scratchpad/dev014-bl100-policies.txt`; https://www.postgresql.org/docs/17/sql-createpolicy.html (server 17.6), accessed 2026-09-16. Unverified: no test has exercised it yet (a rolled-back probe could not `set role goproceed_service` as `postgres`; the fix's first failing test should use `asService("", <another workspace or none>, …)`, which logs in as `goproceed_service_login`); no application code reads or writes either table today (`grep` of `apps/app/src` and `packages/database/src`), so the exposure is reachable only through a service connection. Shown 2026-09-17 by DEV-015: `packages/testing/src/projection-rls.test.ts` at `0085` failed on «declaring A reads only A» (it read both workspaces) and «declaring B writes nothing of A» (update, delete and insert each affected a row) — the assertions after the first failure in each test did not run — and passed in full at `0086` (DEV-015 `scratchpad/dev015-red-db.txt`, `dev015-green-db.txt`).
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes, and before a projection writer ships.

<a id="bl-101"></a>
### BL-101 — P3 — A service transaction that keeps the caller's actor is not confined to the workspace it declares

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-014's `gp-architect` design (O-1). `withServiceTx` (`packages/database/src/tx.ts`) keeps the caller's `app.actor_user_id`, and `goproceed_service` inherits the `to goproceed_app` policies, which combine with its own by `OR`. On the tables both planes can read (`communication_messages`, `communication_message_events`, `communication_attachments`, `telegram_chat_bindings`, `telegram_media_groups`), an actor entitled to workspace A therefore reads A's rows through a service transaction that declared workspace B. This is not a cross-tenant leak, because the actor is entitled to A, but `adoptServiceWorkspace`'s comment («confines every subsequent statement to this workspace») holds only with an empty actor. DEV-014's service-plane tests use an empty actor, so they prove the service policy and not this path. The callers that keep the actor, found by DEV-014's `gp-security` (S1-02): `apps/app/app/v1/projects/[projectId]/communications/route.ts:241`, `.../communications/[messageId]/retry/route.ts:90`, `apps/app/app/v1/assignments/[assignmentId]/communication-card/route.ts:52`, the Telegram `member-link-intents` (`:47`) and `binding-intents` (`:50`) routes, and `apps/app/src/lib/evidence/finalize-upload-intent.ts:29,142,168` (evidence tables); every Telegram processor, ingress, linking and erasure path passes an empty actor. In those routes a lookup by id inside a transaction declared for workspace X can return a row of another workspace where the actor holds `project.view` or `project.admin`. The fix should also say in `adoptServiceWorkspace`'s comment that the confinement holds only with an empty actor. DEV-015 (0086) confined the two readiness projections' service policies and added them to the affected set: `rp_select` and `br_select` still admit an entitled actor's other workspaces to a service transaction. DEV-015's `gp-architect` named the clean fix: a restrictive policy `as restrictive for all to goproceed_service using (workspace_id = app.service_workspace()) with check (…)` on every table both planes read, which combines with every permissive branch by AND and touches only the service role. Ranked by DEV-014.
- **Evidence:** observed 2026-09-17: `packages/testing/src/communication-rls.test.ts` header; a mutation run in DEV-014 (row 5) shows the service-plane assertions depend on the declared workspace. Unverified: a test with a member of both workspaces (`asService(USER, WS_B)` reading A's rows) has not been written.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-102"></a>
### BL-102 — P1 — The service plane's capture-event insert ignores the workspace it declares, and its caller declares none

- **State:** closed → DEV-017
- **Legacy cite:** none
- **Why:** found by DEV-016's `gp-architect`. `ce_insert_server` (`supabase/migrations/0035_server_facts_are_service_only.sql:150-157`) is `event_source = 'server' and exists (select 1 from public.upload_intents u …)`, with no `app.service_workspace()` term, and the `exists` runs under row level security on `upload_intents`, whose only policies are the actor-bound `ui_select` and the session-bound `ui_external_select`, both inherited by `goproceed_service`. So an empty-actor service transaction declaring workspace A is refused every server event, and a transaction carrying an actor entitled to A is admitted whatever workspace it declares. `apps/app/src/lib/evidence/finalize-upload-intent.ts:58` passes `organizationId: null` to its three `withServiceTx` calls (`:29`, `:142`, `:168`), so production server events declare nothing. It is not an unentitled cross-tenant write (the actor must hold `project.view` on the intent's project, and the workspace, intent and project must match), but the `capture_events` `goproceed_service` row of `technical/database/rls-coverage.csv` cannot meet the v0.1 minimum, and readiness gate 11 cannot close while it stays a gap. The smallest fix, for its own task's `gp-architect` to confirm: a migration adding `workspace_id = app.service_workspace()` to `ce_insert_server`'s check, and `finalize-upload-intent.ts` declaring the intent's workspace in the same change (before the migration, or every finalize fails with 42501); or the restrictive service policy BL-101 names. Adding the workspace term alone is not enough: with an empty actor the `exists` over `upload_intents` still matches nothing, so the fix also owes the service plane a read of `upload_intents` confined to the declared workspace (a policy or a `SECURITY DEFINER` helper that validates the workspace/intent/project chain) — otherwise this row's minimum has to be the actor-bearing shape, which is the owner's call. The inherited `ce_select` leaves the same BL-101 class on reads. Start with the failing test: an entitled actor declaring A admitted, the same actor declaring B or nothing refused. Ranked by DEV-016.
- **Evidence:** observed 2026-09-17 at `191dd79` from the policy text (local database at `0086`) and the source lines above. Unverified: no test has declared another workspace; `packages/testing/src/m2-service-principal.test.ts:141` (an entitled actor declaring its own workspace, admitted) is consistent with this reading. Closed 2026-09-18 by DEV-017 (migration `0087`): `packages/testing/src/evidence-service-rls.test.ts` was red at `0086` — an empty-actor transaction declaring A was refused (42501) and one carrying an actor entitled to A was admitted while declaring B — and passes at `0087`; the finalize path now declares the intent's workspace (DEV-017 `scratchpad/dev017-red-db.txt`, `dev017-green-db.txt`).
- **Depends on:** none.
- **Deadline:** before readiness gate 11 closes.

<a id="bl-103"></a>
### BL-103 — P2 — A repeat of an idempotent command replays its stored response before membership is checked

- **State:** closed → DEV-020
- **Legacy cite:** none
- **Why:** found by DEV-016's `gp-architect` (as an `idem_select` observation) and completed by its `gp-security` review (S1-01). `idem_select` on `public.idempotency_records` is `actor_scope = 'user:' || app.current_actor()`, with no workspace or membership term, and `withIdempotency` (`packages/database/src/idempotency.ts:60-85`) replays a stored `response_body` BEFORE it runs its callback — which is where the routes under `apps/app/app/v1/workspaces/[workspaceId]/` (`projects`, `parties`, `invitations`, `requirement-templates`, `project-requirements`, `requirement-rule-versions`) call `requireActiveMembership`. So a user whose membership in that workspace ended, or an admin demoted to member, who repeats the same `Idempotency-Key` with the same body inside the retention window (`standard_30d`, `packages/database/src/idempotency.ts:7`) receives the stored 2xx response again. The content is what that user already received once, which is why this is not P1, but it is a real read after offboarding and the response can carry a secret (BL-104). The occurrence-grants route shows the pattern that avoids it: it resolves the occurrence under RLS before entering the idempotent block (`apps/app/app/v1/.../occurrences/[occurrenceId]/grants/route.ts:27-40,97-101`), so an ex-member gets a 404. The fix is either to check membership before the replay or to re-check it on the replay path; adding an active-membership term to `idem_select` for rows that carry an `organization_id` would close the database half. The v0.1 read minimum still holds for the registry row (a user who was never a member of A reads nothing of A), which is why `idempotency_records` is `covered`. Ranked P2 by the owner on 2026-09-18, after `gp-security` corrected the facts; P3 on 2026-09-17 rested on the replay order being unverified.
- **Evidence:** observed 2026-09-17 at `191dd79` (the `idem_select` policy text, local database at `0086`) and 2026-09-18 at `5c73b70` in the source lines above. Unverified: the full list of affected routes — `gp-security` read the `workspaces/[workspaceId]` routes and not the other idempotent routes.
- **Note, 2026-09-18 (DEV-019):** since BL-104 closed, the `invitations.create` replay carries no token (INV-102), so what a replay returns here is metadata the caller already received; DEV-019's `gp-architect` found no other call site that stores a secret. DEV-020 takes this entry.
- **Closed 2026-09-18 by DEV-020** (migration `0089`): `withIdempotency` runs a required `authorize` step before its lock and lookup on every call, and all 51 call sites moved their membership, role and capability checks into it; `idem_select` now reads a record carrying a workspace only for an active member. The affected set was wider than this entry said: 35 routes resolved their resource first but checked the role or project capability only inside the block (28 of them replayable after a project grant expired or was revoked, the one reduction a v0.1 user can cause through the product), and 6 checked nothing before it. `apps/app/tests/idempotency-authorization.int.test.ts` and the two ended-membership cases in `packages/testing/src/operational-rls.test.ts` were red at `902c214` and pass after the fix. Records without a workspace stay actor-fenced (owner, 2026-09-18).
- **Depends on:** none.
- **Deadline:** before real customer data enters an environment.

<a id="bl-104"></a>
### BL-104 — P1 — `invitations.create` stores the raw invitation token in `idempotency_records.response_body` for thirty days

- **State:** closed → DEV-019
- **Legacy cite:** none
- **Why:** DEV-016's `gp-security` review (S1-01). `apps/app/app/v1/workspaces/[workspaceId]/invitations/route.ts:22-66` returns `{ invitationId, token, expiresAt }` from inside its `withIdempotency` block, so the raw token — the bearer secret the invitee needs — is written to `public.idempotency_records.response_body` and kept for the retention window (30 days), while `public.invitations` deliberately stores only its hash (`token_hash`). Anyone who can read that table outside the API (a backup, a superuser, support tooling) can accept the invitation with the invited role, because `app.accept_invitation` (`supabase/migrations/0011_*.sql:166-201`) checks only the token hash and that the caller is not already a member; it does not tie the token to the invited email (BL-013). The invitation lives up to 720 hours (`packages/contracts/src/invitations.ts:6`), and the stored copy outlives it. The fix is the shape the occurrence-grants route already uses: return a body without the secret from the idempotent block and attach the token outside it, so a replay returns the record without the token. A test should assert that no `invitations.create` record's `response_body` carries a `token` key. Ranked P1 by the owner on 2026-09-18.
- **Evidence:** observed 2026-09-18 at `5c73b70` in the source lines above; `packages/database/src/idempotency.ts:86-95` is the insert that stores the body. Unverified: whether any other route returns a secret from inside an idempotent block. Closed 2026-09-18 by DEV-019 (migration `0088`): the callback returns a strict token-free receipt, the token is attached outside the block only when it ran, and a replay returns `kind: "replayed"` without it, built from named fields; `apps/app/tests/invitations.int.test.ts` was red at `b3045df` — a stored `invitations.create` record carried `token`, and a replay (by the same admin, over a pre-fix record, and by an admin since demoted) returned it — and passes after the fix; `0088` removed the key from the two such rows in the local database. DEV-019's `gp-architect` read all 51 `withIdempotency` call sites: no other one stores a secret. At `b3045df` the insert is `packages/database/src/idempotency.ts:89-99`, not `:86-95`. No hosted database was checked. A lost token cannot be recovered or reissued: BL-107.
- **Depends on:** none.
- **Deadline:** before real customer data enters an environment, and before invitations are sent from any hosted environment.

<a id="bl-105"></a>
### BL-105 — P3 — A capture event's work assignment is bound by nothing, so a defective service transaction could name another workspace's assignment

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-017's `gp-security` review (S1-04). `public.capture_events` has no foreign key on `work_assignment_id` (nor on `project_id`; `0035:145` records why the server branch carries the intent instead), and `0087` binds only the workspace, the intent and the project (`ce_insert_server` through `app.upload_intent_scope_matches`). A service transaction declaring workspace A may therefore write a row of A that names an assignment id belonging to another workspace: not a cross-tenant read and not a cross-tenant write, but a row whose own references do not agree, which every other tenant relation prevents with a composite foreign key (INV-001). Pre-existing; `0087` neither introduces nor closes it. The fix is the composite-FK treatment the rest of the schema uses, or one more term in the policy. Ranked by DEV-017.
- **Evidence:** observed 2026-09-18 at `e7e35aa` from the policy and table definitions (`0015`, `0035`, `0087`); local database at `0087`. Unverified: whether any code path could produce such a row today — the only server writer resolves the assignment from the intent it just read.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-106"></a>
### BL-106 — P3 — `app.service_workspace()` has no pinned `search_path`, and more policies now rest on it

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-017's `gp-security` review (S1-06). `app.service_workspace()` (`0062`) is an invoker `sql` function reading `current_setting('app.organization_id', true)` with no `set search_path` and an unqualified `current_setting`. Every service-plane policy resolves through it — the Telegram tables, the two readiness projections (`0086`) and now `ce_insert_server` (`0087`) — so it is load-bearing. Exploiting it needs a role able to create a shadowing `current_setting` in a schema that precedes `pg_catalog` on the search path, which `goproceed_app` and `goproceed_service` should not have; this is hardening, not an observed hole. The fix is a later migration adding `set search_path to ''` and `pg_catalog.current_setting`, and the same review for `app.current_actor()`. Ranked by DEV-017.
- **Evidence:** observed 2026-09-18 at `e7e35aa`: the function definition in the local database at `0087`. Unverified: whether any role in a hosted project holds `CREATE` on a schema that precedes `pg_catalog`.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-107"></a>
### BL-107 — P2 — A lost invitation cannot be revoked or reissued, so its address stays blocked until it expires

- **State:** closed → DEV-021
- **Legacy cite:** none
- **Why:** since DEV-019 (BL-104) the server keeps only the invitation token's hash, and a replay of `invitations.create` returns `kind: "replayed"` without the token (owner, 2026-09-18). If the admin loses the first response, nothing recovers it: no route revokes or reissues an invitation (`technical/openapi/scope-v0.1.csv` has only `invitations.create` and `invitations.accept`; `technical/test-catalog.csv` T-INVITATION-001 and `ui-actions.csv` A-009/A-010 describe reissue and revoke as future behaviour), and `invitations_pending_email_unique` (`0010`) refuses a new invitation to the same address with 409 `VERSION_CONFLICT` until the pending one expires — 168 hours by default, 720 at most. The recovery path is an `invitations.revoke` (the pending slot freed, then an ordinary create) or a reissue that writes a new `token_hash` and invalidates the old one; `inv_update` (`0014`) already lets an owner or admin update the row. Either adds a `/v1` command to scope-v0.1, which needs an ADR. Ranked P2 by the owner on 2026-09-18.
- **Evidence:** observed 2026-09-18 at `b3045df` by DEV-019's `gp-architect` from the route, the scope catalog and `0010`/`0014`.
- **Closed 2026-09-18 by DEV-021** under [ADR-012](decisions/ADR-012-invitation-revoke.md) (owner-approved 2026-09-18: revoke only): `invitations.revoke` (`POST /v1/invitations/{invitationId}/revoke`, owner/admin, pending → revoked, no secret) and the create's pending-address 409 carrying `details.invitationId`, so recovery from a lost token is revoke, then create. `apps/app/tests/invitation-revoke.int.test.ts` failed at `65d7935` (the route did not exist; the 409 carried no id) and passes after. Reissue was not approved: BL-111.
- **Depends on:** an ADR adding the command to scope-v0.1.
- **Deadline:** before invitations are sent from a hosted environment to real users.

<a id="bl-108"></a>
### BL-108 — P3 — `withIdempotency` stores any body its callback returns, secret or not

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-019's `gp-security` review (S1-01). INV-102 (a stored idempotent response never carries a bearer secret) is held route by route: each route keeps its secret out of the body its callback returns. Nothing generic enforces it, so a new route that returns a token, link or signed URL from inside the block passes typecheck, review of an unrelated diff and every existing test, and stores the secret for the retention window — exactly how BL-104 arose. A guard in `packages/database/src/idempotency.ts` that refuses to store a body carrying a denylisted key (`token`, `link`, `url`, `signedUrl`, `telegramUrl`, `csrfToken`) at any depth, with a unit test where a `token` key throws, would make the rule structural. Check first that no current stored body legitimately uses one of those names. Ranked by DEV-019.
- **Evidence:** observed 2026-09-18 at `8c3772a`: `idempotency.ts:89-99` stores `JSON.stringify(result.body)` unconditionally; DEV-019's `gp-architect` sweep of the 51 call sites.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-109"></a>
### BL-109 — P3 — The planned `invite/{token}` page would carry the invitation token in the URL path

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-019's `gp-security` review (S1-05). `docs/architecture/system-overview.md:307` lists a v0.1 route `invite/{token}` for invitation redemption. A bearer token in the path reaches hosting and proxy access logs, `Referer` headers and analytics, and a link prefetch could consume it. The external review link avoids this by carrying its token in the URL fragment and exchanging it by POST (`apps/app/src/lib/external-link.ts:155-160`). The page does not exist yet, so nothing is exposed today; the entry exists so the page is designed with a fragment or a POST from the start. Ranked by DEV-019.
- **Evidence:** observed 2026-09-18 at `8c3772a`: the route table row; no such page under `apps/app/app`.
- **Depends on:** none.
- **Deadline:** before the redemption page is built.

<a id="bl-110"></a>
### BL-110 — P3 — `app.delete_expired_idempotency` has a `public` search path, not an empty one

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-020's `gp-security` review (S1-05). `app.delete_expired_idempotency` (`supabase/migrations/0007_idempotency_expiry.sql:6-22`) is `SECURITY DEFINER` with `set search_path = public`, where `agents/COMMON.md` asks a definer for an empty search path and schema-qualified references; it fences by actor only. It is not a probe for a former member — its only caller is `withIdempotency`, after `authorize` and after a lookup `0089` has filtered, and it deletes only the caller's own expired rows — so this is hardening, the same class as BL-106. The fix is a later migration that pins `search_path to ''` and qualifies the references. Ranked by DEV-020.
- **Evidence:** observed 2026-09-18 at `ae675a2` from the migration text; local database at `0089`.
- **Depends on:** none.
- **Deadline:** none recorded.

<a id="bl-111"></a>
### BL-111 — P3 — An invitation cannot be reissued in place: recovery from a lost token is revoke, then create

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-021's `gp-architect` designed `invitations.reissue` (`POST /v1/invitations/{invitationId}/reissue`: rotate `token_hash` and `expires_at` on the same pending row, the old token dead in the same statement, the new one returned only by the fresh execution as DEV-019 does, `kind: issued|replayed`, the last reissue winning). The owner approved revoke only on 2026-09-18 (ADR-012), so recovery from a lost token takes two calls and a new invitation id. Reissue would add a second route that mints a secret while BL-108 is open, and it needs its own ADR decision. `technical/ui-actions.csv` A-009 describes it as legacy scope. Ranked by DEV-021.
- **Evidence:** observed 2026-09-18 at `65d7935`: the design in DEV-021 row 1; ADR-012 «What this decision does NOT authorise».
- **Depends on:** an ADR decision; BL-108 is advisable first.
- **Deadline:** none recorded.

<a id="bl-112"></a>
### BL-112 — P2 — A command's request hash covers its body but not its path, so a key reused for another target replays the first target's result

- **State:** open
- **Legacy cite:** none
- **Why:** DEV-021's `gp-security` review (S1-01). `commandRoute` (`apps/app/src/lib/command.ts:76-77`) hashes the raw body only, and `withIdempotency` keys its record on (workspace, actor, operation, key). A command whose target is in the path and whose body does not name it — every command with an empty strict body, and any whose body (say `{ expectedVersion: 1 }`) happens to repeat — therefore answers a key reused for a second target in the same workspace with the first target's stored result, and never touches the second. The caller sees success; the second target is unchanged. Empty-body commands at `65d7935`: `work_items.remove`, `requirement_rule_versions.retire`, `project_requirements.archive`, `requirement_templates.publish`, the requirement-occurrence dry-run, `assignment_communication_cards.publish`, both Telegram intents. It takes a client that reuses a key across targets, which the contract forbids («Reusing the key with a different request fails», `docs/architecture/tenancy-and-security.md`), but the server does not enforce. `invitations.revoke` binds its target into the hash since DEV-021; the general fix is to hash the method and path (or the route's params) with the body in `commandRoute`, which changes every stored hash, so a same-key replay across the deploy would become a 409 — the change needs its own task and a note on that transition. Ranked P2 by DEV-021 (a silent non-execution of a withdrawing command); the owner may re-rank.
- **Evidence:** observed 2026-09-18 at `73b4454`: `command.ts:76-77`, `packages/database/src/idempotency.ts`; the empty-body schemas by grep; DEV-021's red test (`scratchpad/dev021-r2-red-int.txt`: the reused key replayed 200 for another invitation). Unverified: which non-empty bodies collide in practice.
- **Note (DEV-021 Q1-03):** the shared `IDEMPOTENCY_CONFLICT` detail (`apps/app/src/lib/http.ts`) says the key was reused «with a different request body»; for a key reused on another target the body was identical. The general fix should reword it.
- **Depends on:** none.
- **Deadline:** before a client that retries with stored keys is deployed.

## Closed, kept for citations

<a id="bl-075"></a>
### BL-075 — P1 — Valuation funding was first-come and never re-offered

- **State:** closed → `a306ec2`
- **Legacy cite:** `TODOS.md` «valuation funding was first-come and was never re-offered»
- **Why:** kept because live code cites it as «the P1 filed as BL-075» (by a `TODOS.md` line number until DEV-006): `apps/app/src/lib/admission.ts:502`, `apps/app/src/lib/valuation-writer.ts:310`, `apps/app/tests/admission-valuation.int.test.ts:511`. The owner decided on 2026-08-10 that admission is a standing claim.
- **Evidence:** `apps/app/tests/admission-valuation.int.test.ts` «the pool is offered again when the root that held it gives it back», added in `a306ec2`.
- **Depends on:** —
- **Deadline:** —

<a id="bl-076"></a>
### BL-076 — P0 — The pool stranded once an over-removal parted quantity from money

- **State:** closed → `0a7c407`
- **Legacy cite:** `TODOS.md` «the pool stranded once an over-removal parted quantity from money»
- **Why:** kept because live code cites it as «the P0 filed as BL-076» (by a `TODOS.md` line number until DEV-006): `apps/app/src/lib/valuation-writer.ts:161`, `apps/app/tests/progress-adjust.int.test.ts:728`, `packages/domain/src/valuation.ts:234`. The carve denominator answers to the money.
- **Evidence:** `apps/app/tests/progress-adjust.int.test.ts` «the pool a line holds is the share its effective quantity bought», added in `0a7c407`.
- **Depends on:** —
- **Deadline:** —
