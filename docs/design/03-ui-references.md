# UI references — what the dashboard is built from, and what it is not

**Status:** Approved (owner decision, 2026-08-21)
**Applies to:** every screen under `apps/app/app/(dash)/**` — the office dashboard *[2026-09-05: the token and component rules of this file also bind `app/(app)/**` and `app/(auth)/**` since the field client migrated onto `@goproceed/ui`; the plane-derived structure rules (§«The hierarchy») stay dashboard-only.]*
**Read with:** [`02-building-ui.md`](02-building-ui.md) (the procedure and the gate — it wins on every conflict), [`../../.interface-design/system.md`](../../.interface-design/system.md), [`04-role-pain-map.md`](04-role-pain-map.md)

## The three references

The owner named these on 2026-08-21. **Cite them in every dashboard PR** that
borrows a pattern, and name the file you took it from.

| | [ln-dev7/circle](https://github.com/ln-dev7/circle) | [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) |
|---|---|---|
| What it is | Linear-inspired project-management UI | Admin dashboard UI |
| Licence | MIT | MIT |
| Stack | **Next.js App Router** — same router as `apps/app` | Vite + TanStack Router |
| Read on | 2026-08-21 (3.8k★, pushed 2026-08-10) | 2026-08-21 (14k★, pushed 2026-07-21) |
| **We take** | the SHELL and the scoping: `app/[orgId]/…` (maps onto our workspace), `components/layout/sidebar`, `components/layout/headers`, list→detail entity pages, `components/data-table-filter` | the SCREEN patterns: `src/features/tasks/*` (data table + `*-columns`, `*-mutate-drawer`, `*-provider`, row actions) and `src/features/users/*` (+ `users-invite-dialog`), `settings/*` sub-navigation, `command-menu`, `confirm-dialog`, `select-dropdown`, `long-text` |
| **We do NOT take** | issues/cycles/initiatives/reviews/inbox/agent vocabulary, the 30+ settings pages, teams | its ROUTES (TanStack ≠ App Router — they do not port), `chats`, `apps`, `errors` pages, its auth screens (we have OTP already) |

**Both are MIT.** Copied or closely-derived code carries a header naming the
source repository, the file, and the licence — the same discipline
`apps/mobile`'s ports use for `apps/app`.

### The third reference — [makeplane/plane](https://github.com/makeplane/plane), for STRUCTURE ONLY

Named by the owner on 2026-08-21 as «максимально близка к нам, и то что мы
пытаемся построить». It is: an open-source Jira/Linear alternative, 57k★,
TypeScript, pushed the same day it was read (default branch `preview`).

> **⚠️ PLANE IS AGPL-3.0. DO NOT COPY ITS CODE — not a file, not a component,
> not a hook.** AGPL's copyleft reaches network use: code derived from it would
> oblige GoProceed to publish its own source under the same terms. Layout,
> naming and architectural ideas are not copyrightable and are what we take.
> If a PR needs a Plane behaviour, it is re-implemented from the description,
> never from the file — and the PR says so.

What its structure tells us, checked against ours on 2026-08-21:

| Plane | Ours | Reading |
|---|---|---|
| `packages/{ui,types,constants,hooks,utils,services,i18n,tailwind-config,typescript-config}` | `packages/{ui,tokens,contracts,domain,database,testing}` | same shape: one component package, one types/contracts package, shared config. Ours splits domain logic out (`domain`) where Plane splits `services`; both keep UI alone. |
| `apps/web` — the product | `apps/app` | same role |
| `apps/admin` — separate god-mode surface | *(none)* | we deliberately have none: ADR-009's dashboard is inside `apps/app`, gated by capability, not a second app |
| **`apps/space` — the public, NO-ACCOUNT surface** | **`apps/app/app/external/**`** | **the strongest confirmation.** A serious product in this category ships a distinct no-account surface for outside reviewers — which is exactly the adoption path the demand scan names for технагляд (see [`04-role-pain-map.md`](04-role-pain-map.md)). We reached the same answer as a route group rather than an app; the difference is deployment granularity, not model. |
| `apps/api`, `apps/live`, `apps/proxy` | `apps/app` (BFF) + Supabase | they run their own Django API and websocket tier; we do not, and this is where the resemblance stops. |

**Conclusion recorded so it is not re-litigated:** Plane validates the shape we
already have. It changes no decision in ADR-009. Its `packages/ui`-holds-every-
component convention is the same one this repository already follows — see the
next section.

## The component base — where shadcn/ui goes, and why it is not a second system

**Owner's decision, 2026-08-21 (two messages, second refining the first):**
introduce shadcn/ui for the dashboard, themed by our tokens — and **put shadcn
and every component in `packages/ui`**, not in the app.

That second instruction resolves a conflict the first one would have created,
and the reason is worth recording because it is easy to get wrong:

- `packages/ui` **already is a shadcn-shaped system**. It ships `radix-ui@1.6.7`,
  `clsx`, `tailwind-merge` and `lucide-react`; `Button.tsx` already composes
  Radix's `Slot` for `asChild`, exactly as shadcn's Button does. What differs is
  only that classes name our token ROLES instead of shadcn's own CSS variables.
- Its inventory file says the missing pieces are **scheduled, not absent**:
  «Dialog, Drawer, DropdownMenu, Popover, CommandPalette — Phase 4, with the app
  shell that needs them. **Radix ships all of them in the one dependency already
  installed, so this is scheduling, not a gap**» and «Select, Combobox,
  DatePicker, Checkbox, Radio, Switch — with the first real form»
  (`packages/ui/src/components/index.ts:9-20`). Plan D **is** that app shell and
  that first real form: the schedule has arrived.
- `02-building-ui.md` §3.1 names the failure mode directly: «Building a second
  Button is the most expensive mistake available here.» A parallel
  `apps/app/components/ui` tree would have been exactly that.

**The rule for every dashboard PR, therefore:**

1. A component the dashboard needs is added to **`packages/ui/src/components`**,
   on the already-installed Radix primitive, exported from that package's index,
   and its absence note in `index.ts` is updated in the same commit.
2. The reference implementations (shadcn/ui itself, and the two MIT repos above)
   are the SOURCE for structure and behaviour; the styling is rewritten in token
   roles. A shadcn CSS variable, a hex, or an `oklch()` literal in the diff is a
   defect — `02-building-ui.md` §1 and the primitive-leak test already say so.
3. Attribution header on anything closely derived, naming repo + file + licence.
4. **`02-building-ui.md`'s §5 gate still runs and still decides.** A component
   that fails it is not shipped because «the reference does it».
5. Density rule that overrides both references: `apps/app` may use none of the
   marketing scale, `radius-card`, `surface`, `section` or `shadow-float`
   (§3.3). Structure there is border-led — «`shadow-md` on a panel → nothing,
   use `border border-line`». The references lean on cards and shadows; that
   part does not come across.

## The hierarchy — plane's shape, mapped onto our tree

**Owner's instruction, 2026-08-21:** even when a pattern comes from circle or
shadcn-admin, **implement it the way plane structures it**. Read from
[`makeplane/plane`](https://github.com/makeplane/plane) `@preview` on
2026-08-21 (structure only — its code is AGPL and never enters this repo):

```
apps/web/
  app/                      routes ONLY — layout.tsx / page.tsx per segment, thin
  core/
    components/<domain>/    domain-grouped, kebab-case files
    layouts/                auth-layout, default-layout
    services/               one <domain>.service.ts per domain, over the API
    hooks/  lib/  store/
packages/{ui,types,constants,hooks,utils,services,i18n}
```

Their `core/` is our `apps/app/src/`. The mapping, binding for every dashboard PR:

| plane | ours | rule |
|---|---|---|
| `app/**` | `apps/app/app/**` | **routes only.** A page file wires params, calls a service, and renders a component from `src/components/<domain>`. Logic in a route file is a defect. |
| `core/components/<domain>/` | `apps/app/src/components/<domain>/` | grouped by DOMAIN (`dash-shell`, `evidence`, `assignments`, `members`), never by type. **Files are kebab-case** — `workspace-switch.tsx`, not `WorkspaceSwitch.tsx` — matching plane (`archive-issue-modal.tsx`, `issue-type-switcher.tsx`). The exported component keeps PascalCase. |
| `core/layouts/` | `apps/app/src/layouts/` | the shell chrome, separate from the domain components it wraps |
| `core/services/<d>.service.ts` | `apps/app/src/services/<d>.service.ts` | **one module per domain** over `src/lib/api.ts` — `projects.service.ts`, `evidence.service.ts`. A component never calls `apiGet`/`apiPost` directly; it calls a service. This is what makes a screen testable without a route. |
| `core/lib/` | `apps/app/src/lib/**` | pure/shared logic — already used this way (`lib/field`, `lib/capture`) |
| `packages/types`, `packages/constants` | `packages/contracts`, `technical/copy-catalog.csv` | we already have both, under different names |

What we deliberately do NOT copy from plane: MobX (`core/store`) — our reads are
server components and the pattern in `app/(app)/page.tsx` already works; and its
split into `apps/admin` / `apps/space` — ADR-009 keeps the dashboard inside
`apps/app`, and `/external` is our `space`.

## Why a reference at all

`apps/demo` carried the previous internal dashboard and was retired on
2026-08-20 (README «Product surfaces»), so the office UI starts from zero in
`apps/app` — three pages exist today, all of them the field client's. Rather
than invent a shell, we take one that is already coherent, and spend the saved
effort on the domain: the screens in [`04-role-pain-map.md`](04-role-pain-map.md).

## Landing references — 21st.dev patterns (added 2026-09-05)

**Status:** Approved (owner decision, 2026-09-05, with the Daylight prototype)
**Applies to:** `apps/landing/**`

The landing is built after recognisable community components from
[21st.dev](https://21st.dev), taken as **structure** and restyled in token
roles — no registry install, no pasted CSS variables, no raw hex (the same
rule the dashboard applies to shadcn). Each block names its source:

| Block | Pattern | What we take | What we do not | Source read 2026-09-06 · licence |
|---|---|---|---|---|
| Hero pill | Announcement | badge + copy + arrow, `asChild` link; magnetic on hover | its gradient border | 21st.dev `haydenbleasel/announcement` (kibo-ui) · MIT |
| Product frame | Container Scroll Animation + Border Beam | the tilt-and-settle entry (`ScrollSettle`), the pointer lean (`Tilt`), the depth layers (`Depth`), the ring of light (infinite, CSS) | the dark bezel | Aceternity `container-scroll-animation` · Aceternity License (structure only, nothing copied); Magic UI `border-beam` · MIT |
| Background | Dot Pattern | the dot field with a radial mask | the glow variant | Magic UI `dot-pattern` · MIT |
| Roles | Grid Feature Cards | 1px-gap cells, pointer spotlight, pointer tilt ≤ 3° | — | 21st.dev `efferd/grid-feature-cards` · licence unstated (structure already ours) |
| Provenance | Bento Grid | a two-row cell beside two stacked cells, staggered | icon-led filler cells | Magic UI `bento-grid` · MIT |
| Route | Fora's sticky feature stack | five sticky cards, sides alternating, the scale/veil scrub and the media parallax (`ScrollStack`) | — | Aceternity `sticky-scroll-reveal` · Aceternity License (structure only) |
| Pilot plan | Steppers / Timeline | vertical steps with a progress line scrubbed by the scroll (`ScrollProgress`) | timed autoplay | Aceternity `timeline` · Aceternity License (structure only) |
| Closing | Cta-4 | light card, copy left, actions right | a second signal button | 21st.dev `shadcnblockscom/cta-4` · licence unstated (structure already ours) |
| Headings | Text Generate Effect | per-word spans as the unit of a heading reveal; the line grouping is ours (`LineReveal`) | the blur | Aceternity `text-generate-effect` · Aceternity License (structure only) |
| Pointer words | Magnetic, Tilt | the spring-driven follow and lean (`Magnetic`, `Tilt`) with our springs | their default springs | motion-primitives (`ibelick/motion-primitives`) · MIT |

Spec: `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` §6, amended by
`docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md` §3 and §7
(the full source list with URLs).
