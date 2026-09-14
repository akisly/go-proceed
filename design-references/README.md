# Design references

> **Mostly historical exploration, with live parts named below** (DEV-007, 2026-09-14). The normative design is
> [`DESIGN.md`](../DESIGN.md) and [`docs/design/`](../docs/design/): [`01-tokens.md`](../docs/design/01-tokens.md) for values,
> [`02-building-ui.md`](../docs/design/02-building-ui.md) for the procedure. Nothing here overrides them; where a file below
> disagrees with them, they win.

Files here keep the product's pre-rename name where they were written before the rename, and the validator exempts the directory
as a record (`ROLE_RECORD_DIRS` in `scripts/validate-canonical-docs.mjs`). That exemption also covers `brand/`, the live icon source, so nothing checks those files for the pre-rename name.

| Path | What it is | Standing | Read by |
|---|---|---|---|
| `brand/*.svg` | Source drawings of the mark and every icon (added `bbfc705 2026-08-28`) | **Live source.** Icons are rasterised from these files | `scripts/generate-brand-icons.mjs` |
| `contest-2026-09/daylight/` | The Daylight landing prototype from the September 2026 design contest (added `1270d5f 2026-09-05`) | **Source of the landing's colours** (owner, 2026-09-14), which `DESIGN.md`'s Daylight palette carries. No longer the landing's reference: since 2026-09-14 that is https://parlo-black.vercel.app/, and the rebuild is BL-082. The shipped landing still reproduces it; one motion token cites it by path, and 31 token rulings were measured from it | `apps/landing/app/layout.tsx` (its parity note); `packages/tokens/src/tokens.json` (the `stately` duration's ruling) |
| `evidence-atlas/` | «Direction 02 — Evidence Atlas», the AktFlow-era direction and its synthetic imagery (added `907f8a7 2026-07-26`) | **Historical direction**, superseded by Daylight, except `assets/`: the source masters of the landing's route-card grounds, cut to its README's crop rules | `apps/landing/qa/grounds.mjs`, which writes `apps/landing/public/images/`; listed in `PRODUCT.md` |
| `visual-directions/` | Three AktFlow-era landing directions, 23 July 2026 (added `907f8a7 2026-07-26`) | **Historical** | — |
| `*-concept.png` | Concept boards: `dashboard-concept.png` (907f8a7 2026-07-26), `landing-concept.png` (907f8a7 2026-07-26), `mobile-field-concept.png` (907f8a7 2026-07-26), `onboarding-concept.png` (907f8a7 2026-07-26) | **Historical** | — |
