# Evidence Atlas — selected visual direction

## Status

`Direction 02 — Evidence Atlas` is the normative visual direction for the AktFlow prototype. The source board is preserved as `selected-direction.png`; it is a visual target, not a screenshot to ship as UI.

## Product thesis

AktFlow is presented as a living evidence dossier rather than a generic CRM dashboard. Every consequential amount must remain visibly connected to work, requirement, capture, review, immutable receipt, package version and payment state.

The visual hierarchy is intentionally documentary:

1. Paper is the primary working surface.
2. Carbon is reserved for navigation, high-consequence stages and mobile field chrome.
3. Lime communicates an actionable next step or a verified state, never generic decoration.
4. Slate carries annotations, reference rules and secondary structure.
5. Layered folios, stamps and cross-reference rails make provenance understandable before the user reads detailed metadata.

## Asset inventory

| Asset | Source | Production use | Crop rules |
|---|---|---|---|
| `selected-direction.png` | chosen Product Design direction | visual QA reference only | never crop into production UI |
| `assets/blueprint-folio.png` | generated, synthetic | landing hero, authentication, onboarding, document/dossier surfaces | preserve paper edges; safe 16:10, 4:3 and 3:2 crops |
| `assets/cable-tray-evidence.png` | generated, synthetic | evidence viewer, field capture, landing mobile task | keep the central cable bend visible; safe 16:10 and 4:5 crops |
| `assets/verified-stamp.png` | generated, synthetic | immutable receipts, hero proof object, audit moments | preserve the transparent checker-free crop and original ink colors |

All production imagery is synthetic and contains no customer data, people, logos or readable project documents.

## Canonical tokens

| Token | Value | Meaning |
|---|---:|---|
| Carbon | `#171717` | primary ink and consequential chrome |
| Lime | `#c6ff34` | next action / verified signal |
| Slate | `#484c5e` | annotation, secondary text, rules |
| Paper | `#fbfbfb` | working canvas |
| White | `#ffffff` | top folio sheet |
| Line | `rgba(72,76,94,.18)` | rules and document boundaries |
| Amber | `#f2b84b` | risk or warning |
| Red | `#e45c55` | destructive / blocked |

Paper/White should occupy 74–78% of a typical desktop surface, Carbon 17–21%, and Lime no more than 4–5%.

## Navigation and routing model

- Public: `/` → `/pilot` or `/login`.
- Setup: `/onboarding` → `/app/rules?setup=1` → `/onboarding?step=5` → `/app`.
- Operational chain: `/app` → `/app/work` → `/app/assignments` → `/field` → `/app/evidence`.
- Commercial chain: `/app/evidence` → `/app/close` → `/app/packages/current` → `/review/demo` → `/app/payments`.
- Authority: `/app/rules`, `/app/baseline`, `/app/team`, `/app/settings`.
- Commercial change: `/app/variations` → controlled contract/reference revision in `/app/baseline`.
- SaaS billing remains isolated at `/app/billing`.

The application shell exposes the current dossier, the active section, and the next logical hand-off without making the route rail the only way to navigate.

## Motion

- Folio enter: 8–12 px vertical offset, 420–460 ms, one time.
- Verification stamp: 280 ms scale/opacity, only after a durable receipt.
- Cross-reference rail: 360 ms horizontal draw.
- Folio hover: maximum `translateY(-3px)` over 160–220 ms.
- Mobile receipt: 360 ms from local draft into the dossier.
- Reduced motion: opacity-only state change; no continuous decorative movement.

## UX guardrails

- No primary CTA is inert.
- Status never relies on color alone.
- Buttons name the business consequence.
- Amounts show the state and denominator.
- Returned evidence creates a linked revision; the original and prior review remain visible.
- Project payments and AktFlow subscription billing are visually and terminologically separated.
- Offline, local receipt and server receipt are separate states.
- External acceptance states the exact package version and explicitly says that it is not KEP.
