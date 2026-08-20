# The approved palette reference

`approved-palette.css` is a **frozen, byte-identical copy** of what used to live
at `prototype/src/styles.css`, taken from commit `a85e688^` — the last commit
before `prototype/` was deleted from the tree.

It is not a stylesheet this app loads. It is the **reference standard** three
checks compare against, and nothing else:

| Check | What it asserts against this file |
|---|---|
| `tests/palette.test.ts` | every colour in authored source comes from the approved palette (`buildApprovedPalette`) — in hex, HSL or `oklch()` |
| `tests/styles.test.ts` | `src/styles.css` is a **deletion-only** copy: it introduces zero new literal hex values |
| `qa/verify.mjs` (`auditGeneratedCss`) | the colour in the BUILT bundle — where a Tailwind/shadcn theme's generated colour first becomes visible — stays inside the same palette |

**Why a copy and not the original.** Commit `a85e688` («remove») deleted
`prototype/` wholesale, together with the `_to_delete/` archives. The three
checks above kept pointing into it and went red on every branch, `main`
included. Restoring the whole prototype would have brought back a frozen React
app nobody builds; deleting the checks would have silently dropped the
guarantee that no colour enters outside doc 05. Copying the one file they
actually read keeps the guarantee and drops the dependency.

**Do not edit it to make a test pass.** It records the approved palette as of
the day it was frozen. A genuinely new approved colour is a design decision:
change doc 05 first, then this file, in a commit that says which colour and
why.
