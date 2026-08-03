# Rename slice 3 — "the workspace identifiers" — gate record

**Date:** 2026-08-03
**Branch:** `claude/rename-slice3-packages`, from `claude/docs-slice2-archive` @ `d59fa17`
**Plan:** [2026-08-03-rename-slice3-packages.md](../2026-08-03-rename-slice3-packages.md)
**Spec:** [2026-08-03-rename-slice3-packages-design.md](../../specs/2026-08-03-rename-slice3-packages-design.md)
**Predecessor record:** [2026-08-03-docs-slice2-gate.md](2026-08-03-docs-slice2-gate.md)

## Read this first: what has *not* happened

**CI has not run. Nothing has been pushed — across four slices.** The remote exists and
carries nine branches; this is not one of them, and the branch has no upstream:

```
$ git remote -v
origin	git@github.com:akisly/akt-flow.git (fetch)
origin	git@github.com:akisly/akt-flow.git (push)
$ git ls-remote --heads origin claude/rename-slice3-packages; echo "exit=$?"
exit=0
        (no output — no remote branch of this name exists)
$ git ls-remote --heads origin | wc -l
       9
$ git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
fatal: no upstream configured for branch 'claude/rename-slice3-packages'
```

This is the first slice that **renames** rather than moves. Ten workspace packages, the
root package name and one CSS class changed identity across 86 files, and **no
continuous-integration run has observed any of it.**

**Two things a reader will otherwise take from this record that it does not support.**

1. **"Five typechecks clean" is much weaker evidence than it sounds.** Four of the five
   are structurally incapable of failing on this rename. Exactly one performs a real
   module resolution, and only because a symlink was made by hand. Both facts are
   measured below, not asserted.
2. **The strongest evidence here is not a typecheck.** It is the lockfile's structural
   agreement with eleven on-disk `package.json` files, and a differential typecheck of
   `apps/app` that reproduces the slice base's error set byte for byte.

Every command in this record was executed on this machine, in this checkout, at commit
`3a8a8c5`, while writing it. Nothing is transcribed from a task report without being
re-run. Where a claim in this slice's own paperwork did not reproduce, that is stated
rather than smoothed over — see "Claims in this slice's own documents that do not
reproduce", which contains four.

## Evidence

| Gate | Result |
|---|---|
| Five typechecks **before**, at `d59fa17` | **PASS** — 0 errors each; measured in a detached checkout |
| Five typechecks **after**, at `3a8a8c5` | **PASS** — 0 errors each — **but see "The typecheck evidence is thinner than it looks"** |
| `packages/testing` symlink mutation | **PASS** — removing the hand-made symlink reds it (`TS2307`); restored |
| `apps/app` differential typecheck | **PASS (assisted)** — with resolution restored, byte-identical to `d59fa17`'s error set |
| `pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts` | **PASS** — 5 tests, 5 passed |
| `pnpm --filter @aktflow/testing …` (the old name) | **PASS (negative)** — `No projects matched the filters` |
| `node scripts/validate-canonical-docs.mjs` | **PASS** — `canonical documentation: OK` (exit 0) |
| `python3 scripts/validate_package.py` | **PASS** — `documents=1`, all 15 metrics unchanged (exit 0) |
| Role-strip mutation in the validator | **PASS** — neutering it reds 3 lines; restored, blob hash matches HEAD |
| Lockfile structural proof | **PASS** — 9 keys, all declared, 0 stale, `link:` and `specifier:` sequences identical |
| Boundary: protected strings and fenced trees | **PASS** — five tree hashes identical; no protected identifier renamed |
| `make validate` | **NOT RUN** — `validate-prototype` shells out to `eslint`, absent here (predates this branch) |
| `pnpm install --frozen-lockfile` | **NOT PROVEN — environmental** — settles the lockfile edit; needs a modules purge |
| `pnpm turbo run typecheck` | **NOT PROVEN — environmental** — `exceljs` absent from the installed tree |
| `pnpm turbo run test` | **NOT PROVEN — environmental** — same cause |
| `pnpm turbo run build` | **NOT PROVEN — environmental** — same cause |
| Vercel build reading `apps/demo/vercel.json` | **NOT PROVEN** — only a deploy exercises `--filter=@goproceed/demo` |
| GitHub Actions | **NOT RUN** — never pushed; see above |

### The five NOT PROVEN gates, with the exact command that settles each

Four are the commands CI already runs, quoted from `.github/workflows/ci.yml`:

```
$ grep -n 'frozen-lockfile\|turbo run' .github/workflows/ci.yml | head
41:      - run: pnpm install --frozen-lockfile
70:      - run: pnpm turbo run typecheck
81:      - run: pnpm turbo run test --concurrency=1
83:      - run: pnpm turbo run build
102:      - run: pnpm install --frozen-lockfile
```

- **`pnpm install --frozen-lockfile`** — the only thing that actually validates the
  hand-edited lockfile. It reconciles the nine `importers:` keys against eleven
  `package.json` files and fails if any key names a package no workspace declares.
- **`pnpm turbo run typecheck`** — the only run that typechecks `apps/app`,
  `packages/domain`, `packages/database` and `apps/mobile` with a real module graph.
- **`pnpm turbo run test`** and **`pnpm turbo run build`**.
- **The Vercel build**, which reads `apps/demo/vercel.json`. Nothing in CI executes it:

```
$ grep -n 'buildCommand' apps/demo/vercel.json
3:  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@goproceed/demo",
```

A stale filter here breaks the **deploy**, not CI. The string is correct today; that it
*resolves* is proven only by the local `pnpm --filter` runs below, not by a deploy.

### Why none of them can run here

`exceljs@4.4.0` is declared and lockfile-present but absent from the installed tree:

```
$ git ls-files '*package.json' | xargs grep -ln 'exceljs'
apps/app/package.json
packages/domain/package.json
$ ls node_modules/.pnpm | grep -ci exceljs
0
```

The condition predates slice 0's base and is traced to `314fb58` in
[slice 0's gate record](2026-08-03-docs-slice0-gate.md). Reconciling it needs a
`pnpm install` that rebuilds `node_modules` across all 11 workspace projects — the
owner's call, ruled on 2026-08-03 to hand-edit and let CI prove it. **No install was
attempted**, per the plan's Global Constraints.

`make validate` was not run for the same reason slice 2 did not run it: `validate-prototype`
shells out to `eslint`, which is not on PATH. Both halves of it that concern
documentation — `validate-canonical` and `validate-contracts` — are the two validator
rows above, invoked directly.

## The lockfile's structural proof — this is the slice's strongest evidence

A rename is exactly the kind of change where a mechanical cross-check beats a passing
test, because a missed reference is a *resolution failure* rather than a wrong answer.
The lockfile carries nine `importers:` entries keyed by package name. Only the key
changed.

### Every key is declared, and no stale key survives

```
$ python3 - <<'PY'
import re, json, pathlib
lock = pathlib.Path("pnpm-lock.yaml").read_text(encoding="utf-8")
declared = {json.loads(p.read_text(encoding="utf-8")).get("name")
            for p in pathlib.Path(".").glob("*/*/package.json")
            if "node_modules" not in str(p)}
keys = set(re.findall(r"'(@(?:aktflow|goproceed)/[a-z]+)':", lock))
print("lockfile workspace keys:", sorted(keys))
print("undeclared keys        :", sorted(keys - declared) or "none")
print("stale aktflow keys     :", sorted(k for k in keys if k.startswith("@aktflow/")) or "none")
links = re.findall(r"version: (link:[^\s]+)", lock)
print("link: paths            :", len(links), "unique:", len(set(links)))
PY
lockfile workspace keys: ['@goproceed/contracts', '@goproceed/database', '@goproceed/domain', '@goproceed/tokens', '@goproceed/ui']
undeclared keys        : none
stale aktflow keys     : none
link: paths            : 9 unique: 7
$ grep -c "'@goproceed/" pnpm-lock.yaml
9
$ grep -c "'@aktflow/" pnpm-lock.yaml
0
```

Nine *entries* naming five *distinct* packages — `contracts` ×4, `domain` ×2,
`database`, `tokens`, `ui` — because a package appears once per importer that depends on
it. `@goproceed/testing` has no entry: nothing depends on it, it is only ever run.

### Not one `link:` path and not one `specifier:` line moved

The claim the design rests on is that no directory moved, so no path can change. Checked
across the whole slice rather than one commit, and as an **ordered sequence** rather than
a set — a set comparison would pass even if two importers swapped dependencies:

```
$ python3 - <<'PY'
import re, subprocess
def lock_at(rev):
    return subprocess.run(["git","show",f"{rev}:pnpm-lock.yaml"],capture_output=True,text=True,check=True).stdout
before, after = lock_at("d59fa17"), lock_at("HEAD")
for name, txt in (("BEFORE d59fa17", before), ("AFTER  HEAD    ", after)):
    print(f"{name}: link: paths={len(re.findall(r'version: (link:[^\s]+)', txt))}"
          f"  specifier: lines={len(re.findall(r'^\s*specifier: (.+)$', txt, re.M))}")
lb = re.findall(r"version: (link:[^\s]+)", before); la = re.findall(r"version: (link:[^\s]+)", after)
sb = re.findall(r"^\s*specifier: (.+)$", before, re.M); sa = re.findall(r"^\s*specifier: (.+)$", after, re.M)
print("link: path SEQUENCE identical (order included):", lb == la)
print("specifier: line SEQUENCE identical            :", sb == sa)
for p in la: print("   ", p)
PY
BEFORE d59fa17: link: paths=9  specifier: lines=87
AFTER  HEAD    : link: paths=9  specifier: lines=87

link: path SEQUENCE identical (order included): True
specifier: line SEQUENCE identical            : True
    link:../../packages/contracts
    link:../../packages/database
    link:../../packages/domain
    link:../../packages/ui
    link:../../packages/tokens
    link:../contracts
    link:../domain
    link:../contracts
    link:../contracts
```

**All 87 `specifier:` lines byte-identical, all 9 `link:` paths an identical sequence.**
The diff is nine lines out and nine lines in, and every one of them is a key:

```
$ git diff --stat d59fa17..HEAD -- pnpm-lock.yaml
 pnpm-lock.yaml | 18 +++++++++---------
 1 file changed, 9 insertions(+), 9 deletions(-)
$ git diff d59fa17..HEAD -- pnpm-lock.yaml | grep -E '^[+-].*link:'
(no output)
$ git diff d59fa17..HEAD -- pnpm-lock.yaml | grep -E '^[+-].*specifier:'
(no output)
```

### Every importer's key set agrees with its own `package.json`

The check that stands in for `pnpm install --frozen-lockfile`. Not a sample — **all
eleven importers**, each compared against the dependency blocks of the file on disk:

```
$ python3 - <<'PY'
import re, json, pathlib
lock = pathlib.Path("pnpm-lock.yaml").read_text(encoding="utf-8")
imp = lock.split("importers:",1)[1].split("\npackages:",1)[0]
rows, mismatches = [], []
for b in re.split(r"\n  (?=\S)", imp):
    m = re.match(r"\s*([^\s:]+):", b)
    if not m: continue
    path = m.group(1)
    keys = set(re.findall(r"'(@goproceed/[a-z]+)':", b))
    d = json.loads((pathlib.Path("." if path == "." else path)/"package.json").read_text(encoding="utf-8"))
    deps = set()
    for f in ("dependencies","devDependencies","peerDependencies"):
        deps |= {k for k in d.get(f,{}) if k.startswith("@goproceed/")}
    rows.append((path, d.get("name"), sorted(keys), keys == deps))
    if keys != deps: mismatches.append(path)
print(f"importers in lockfile: {len(rows)}")
for path,name,k,ok in rows: print(f"{path:<20} {str(name):<24} {'YES' if ok else 'NO '}   {k}")
print("mismatches:", mismatches or "none")
PY
importers in lockfile: 11
.                    goproceed                YES   []
apps/app             @goproceed/app           YES   ['@goproceed/contracts', '@goproceed/database', '@goproceed/domain']
apps/demo            @goproceed/demo          YES   []
apps/landing         @goproceed/landing       YES   ['@goproceed/ui']
apps/mobile          @goproceed/mobile        YES   ['@goproceed/tokens']
packages/contracts   @goproceed/contracts     YES   []
packages/database    @goproceed/database      YES   ['@goproceed/contracts', '@goproceed/domain']
packages/domain      @goproceed/domain        YES   ['@goproceed/contracts']
packages/testing     @goproceed/testing       YES   ['@goproceed/contracts']
packages/tokens      @goproceed/tokens        YES   []
packages/ui          @goproceed/ui            YES   []
mismatches: none
```

**Eleven importers, eleven declared names, zero mismatches.** The root importer's name is
`goproceed` — Task 3's root rename, visible here rather than asserted. This is what
`pnpm install --frozen-lockfile` checks; it is the reason the edit is expected to hold,
and it is still not the same thing as having run it.

## The typecheck evidence is thinner than it looks

**Five clean typechecks is the headline number and it is close to worthless on its own.**
Task 1's reviewer established why, and every part of it reproduces here.

Before, at the slice base, in a detached checkout:

```
$ git status --porcelain          # clean but for the three untracked user-added paths
$ git checkout --detach d59fa17
HEAD is now at d59fa17 docs: twenty-four of the twenty-five, not all of them
$ for d in apps/demo apps/landing packages/testing packages/tokens packages/contracts; do
    printf "%-20s " "$d"; (cd "$d" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
  done
apps/demo            0
apps/landing         0
packages/testing     0
packages/tokens      0
packages/contracts   0
$ printf "%-20s " "apps/app"; (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
apps/app             137
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -oE "Cannot find module '[^']+'" | sort | uniq -c)
   2 Cannot find module 'zod'
   1 Cannot find module 'exceljs'
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | sort) > "$SCRATCH/appapp-base.txt"
$ git checkout claude/rename-slice3-packages
Switched to branch 'claude/rename-slice3-packages'
```

After, at `3a8a8c5`: identical — `0` for all five. The `apps/app` baseline captured here
is what the differential proof two sections below is measured against; **at the base its
only unresolved modules are `zod` and `exceljs`**, because the July install left
`@aktflow/*` links behind and the base still refers to them.

### Four of the five cannot fail on this rename

The decisive test is not "did it pass" but "what would it have had to resolve". Every
reference each package makes, listed in full rather than sampled:

```
$ for p in apps/landing packages/tokens packages/contracts apps/demo packages/testing; do
    echo "--- $p ---"; git ls-files "$p" | xargs grep -n '@goproceed/' 2>/dev/null
  done
--- apps/landing ---
apps/landing/app/layout.tsx:4:import "@goproceed/ui/tokens.css";
apps/landing/app/layout.tsx:5:import "@goproceed/ui/base.css";
apps/landing/package.json:2:  "name": "@goproceed/landing",
apps/landing/package.json:16:    "@goproceed/ui": "workspace:*",
--- packages/tokens ---
packages/tokens/package.json:2:  "name": "@goproceed/tokens",
packages/tokens/scripts/generate-native.mjs:38:  " * declared here rather than imported so @goproceed/tokens stays free of a",
packages/tokens/src/index.ts:1:// Consumers import from "@goproceed/tokens", never from the generated path — so
packages/tokens/src/tokens.generated.ts:42: * declared here rather than imported so @goproceed/tokens stays free of a
--- packages/contracts ---
packages/contracts/package.json:2:  "name": "@goproceed/contracts",
packages/contracts/src/project-access.ts:4:// enum (what the grant API accepts), ProjectCapability in @goproceed/domain (what
packages/contracts/src/project-access.ts:6:// (what the database stores). @goproceed/contracts deliberately has no dependency
--- apps/demo ---
   (16 hits, none of them another package: its own name in README.md, package.json,
    vercel.json, and `pnpm --filter @goproceed/demo` strings inside comments)
--- packages/testing ---
packages/testing/package.json:2:  "name": "@goproceed/testing",
packages/testing/package.json:13:    "@goproceed/contracts": "workspace:*"
packages/testing/src/capability-vocabulary.test.ts:4:import { projectCapability } from "@goproceed/contracts";
```

- **`packages/tokens` and `packages/contracts` are leaves.** Their only `@goproceed/`
  references are their own `name` field and three comments. There is nothing for `tsc` to
  resolve, so the typecheck cannot notice a rename.
- **`apps/demo` never names another package.** All sixteen hits are its own name, in
  prose, `vercel.json`, and `pnpm --filter` strings inside comments. `tsc` resolves none
  of them.
- **`apps/landing` passes without ever resolving its two imports.** They are CSS
  side-effect imports, and `tsc --listFiles` — the authoritative answer to "what did the
  compiler actually read" — never reaches either file:

```
$ (cd apps/landing && npx tsc --noEmit -p tsconfig.json --listFiles | grep -c 'goproceed\|packages/ui\|packages/tokens')
0
```

Zero. And the resolution would fail if it were attempted, because the directory it needs
does not exist:

```
$ ls -la apps/landing/node_modules/@goproceed
ls: apps/landing/node_modules/@goproceed: No such file or directory
```

**`apps/landing` typechecks clean while the package it imports is unresolvable.** That is
the sharpest single statement of how little the "five clean" number carries.

### The fifth passes only because of a symlink made by hand

`packages/testing` is the one real module resolution — and this checkout cannot run
`pnpm install`, so Task 1's implementer created the link that a real install would have
made:

```
$ ls -la packages/testing/node_modules/@goproceed/ packages/testing/node_modules/@aktflow/
packages/testing/node_modules/@goproceed/:
lrwxr-xr-x  1 akisliy  staff  18 Aug  3 23:17 contracts -> ../../../contracts

packages/testing/node_modules/@aktflow/:
lrwxr-xr-x  1 akisliy  staff  18 Jul 30 00:20 contracts -> ../../../contracts
```

Created 23:17 on 2026-08-03, beside the July 30 `@aktflow` link from the last real
install. Nothing was committed — `node_modules/` is gitignored and no path under it is
tracked:

```
$ git check-ignore -v packages/testing/node_modules/@goproceed
.gitignore:1:node_modules/	packages/testing/node_modules/@goproceed
$ git ls-files | grep -c 'node_modules'
0
```

**The link is load-bearing, proven by removing it rather than by reasoning about it:**

```
$ mv packages/testing/node_modules/@goproceed "$SCRATCH/goproceed-symlink-probe"
$ (cd packages/testing && npx tsc --noEmit -p tsconfig.json)
src/capability-vocabulary.test.ts(4,35): error TS2307: Cannot find module '@goproceed/contracts' or its corresponding type declarations.
    error count: 1
$ mv "$SCRATCH/goproceed-symlink-probe" packages/testing/node_modules/@goproceed
$ (cd packages/testing && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
0
```

So the honest summary of the local typecheck evidence is: **one package performs a real
resolution of a renamed import, and it does so through hand-patched module resolution.**

### The four that could not run, and why that is not this slice's doing

```
$ ls packages/ui/tsconfig.json
ls: packages/ui/tsconfig.json: No such file or directory
$ (cd apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
162
$ (cd apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -oE "Cannot find module '[^']+'" | sort | uniq -c | sort -rn | head -4)
   1 Cannot find module 'react-native'
   1 Cannot find module 'expo-router'
   1 Cannot find module '@goproceed/tokens'
   1 Cannot find module './status-labels.generated.json'
```

`apps/mobile`'s **162** matches the plan's documented pre-existing baseline exactly. Its
dependencies are not installed; `expo-router` and `react-native` are absent for reasons
that predate this branch.

`packages/database` reads **2** errors at HEAD rather than the plan's documented **6** —
and that is not an improvement. Without `node_modules/@goproceed/domain` the compiler
stops at the import and never reaches `../domain/src/import/xlsx.ts`, where the six
`exceljs` errors live. With resolution restored (next section) it reads exactly **6**,
reproducing the documented baseline. **A lower error count from an earlier failure is not
a better result**, and a reader comparing bare numbers would have drawn the opposite
conclusion.

`packages/domain` is the same shape in the other direction, and it belongs here for
completeness — the first issue of this record omitted it, which left the one package
whose number *rises* unexplained. It declares `exceljs` directly, so it can never be
clean; its count moves only with module resolution:

```
                                     errors   unresolved modules
  at d59fa17 (base)                     7     exceljs ×2
  at 3a8a8c5, unassisted                8     exceljs ×2, @goproceed/contracts ×1
  at 3a8a8c5, resolution restored       7     exceljs ×2
```

Base 7, assisted 7, unassisted 8 — measured, the base value in the same detached
checkout as the rest. **The single extra error is the missing symlink, not the rename**,
and it disappears the moment resolution is restored. Together with `packages/ui` (no
`tsconfig.json`), `apps/mobile` (162) and `packages/database` (6), that is the complete
account of the four packages outside the five-typecheck set.

## `apps/app` — the gap the ledger recorded as unclosable, and what actually closes it

**`apps/app` is the largest part of this change and nothing in the evidence set above
touches it.**

```
$ git show --name-only --format= 74ba335 | grep -c .
64
$ git show --name-only --format= 74ba335 | grep -c '^apps/app/'
41
$ for p in contracts database domain; do
    printf "@goproceed/%-10s in apps/app: %s occurrences / %s files\n" "$p" \
      "$(git ls-files apps/app | xargs grep -o "@goproceed/$p" 2>/dev/null | wc -l)" \
      "$(git ls-files apps/app | xargs grep -l "@goproceed/$p" 2>/dev/null | wc -l)"
  done
@goproceed/contracts  in apps/app: 38 occurrences / 38 files
@goproceed/database   in apps/app: 39 occurrences / 38 files
@goproceed/domain     in apps/app: 10 occurrences / 10 files
```

**41 of Task 1's 64 files** — the controller's ledger says 42; it is 41, see the counting
section — and all three highest-fanout dependency renames.

Run as the tree stands, it fails hard:

```
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
277
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 \
     | grep -oE "error TS[0-9]+: Cannot find module '[^']+'" | sort | uniq -c | sort -rn)
  36 error TS2307: Cannot find module '@goproceed/database'
  36 error TS2307: Cannot find module '@goproceed/contracts'
   9 error TS2307: Cannot find module '@goproceed/domain'
   2 error TS2307: Cannot find module 'zod'
```

### The controller's ruling does not reproduce

The ledger records that the controller tried to close this gap with symlinks and that
**"it does not work and the gap cannot be closed locally"**, attributing the residue to
`packages/contracts` being unable to resolve its own dependency so that "its type
declarations never build and `@goproceed/contracts` stays unresolved regardless of the
link".

**That diagnosis is wrong, and the gap does close.** The controller created links only
inside `apps/app`. Reproducing that first shows why it looked unclosable:

```
$ mkdir -p apps/app/node_modules/@goproceed
$ for p in contracts database domain; do ln -s "../../../../packages/$p" "apps/app/node_modules/@goproceed/$p"; done
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | sort) > "$SCRATCH/appapp-head-linked.txt"
$ wc -l < "$SCRATCH/appapp-head-linked.txt"
     140
$ grep -oE "error TS[0-9]+: Cannot find module '[^']+'" "$SCRATCH/appapp-head-linked.txt" | sort | uniq -c | sort -rn
   2 error TS2307: Cannot find module 'zod'
   2 error TS2307: Cannot find module '@goproceed/domain'
   1 error TS2307: Cannot find module 'exceljs'
   1 error TS2307: Cannot find module '@goproceed/contracts'
```

277 → 140. And the three residual `@goproceed/*` failures are **not in `apps/app` at
all** — they are in sibling packages pulled in through the project graph, each missing
its own link. Diffed against the slice base's error set, they are the *only* additions:

```
$ diff "$SCRATCH/appapp-base.txt" "$SCRATCH/appapp-head-linked.txt"
0a1,2
> ../../packages/database/src/audit.ts(3,34): error TS2307: Cannot find module '@goproceed/domain' or its corresponding type declarations.
> ../../packages/database/src/outbox.ts(2,35): error TS2307: Cannot find module '@goproceed/domain' or its corresponding type declarations.
6a9
> ../../packages/domain/src/organization.ts(1,48): error TS2307: Cannot find module '@goproceed/contracts' or its corresponding type declarations.
```

`@goproceed/contracts` **did** resolve for `apps/app` — 36 errors disappeared. The one
surviving `contracts` failure belongs to `packages/domain`, a different package with a
different missing symlink. Reading a per-package residue as a global one is what produced
the ruling.

### Restoring the full resolution layer, and the differential result

A real `pnpm install` creates one link per dependency edge. That set is enumerable — it
is exactly the set the July install left behind:

```
$ find . -path '*/node_modules/@aktflow/*' -maxdepth 5 -type l | sort | tee "$SCRATCH/aktflow-links.txt"
./apps/app/node_modules/@aktflow/contracts
./apps/app/node_modules/@aktflow/database
./apps/app/node_modules/@aktflow/domain
./apps/landing/node_modules/@aktflow/ui
./node_modules/.pnpm/node_modules/@aktflow/app
./node_modules/.pnpm/node_modules/@aktflow/contracts
./node_modules/.pnpm/node_modules/@aktflow/database
./node_modules/.pnpm/node_modules/@aktflow/demo
./node_modules/.pnpm/node_modules/@aktflow/domain
./node_modules/.pnpm/node_modules/@aktflow/landing
./node_modules/.pnpm/node_modules/@aktflow/testing
./node_modules/.pnpm/node_modules/@aktflow/ui
./packages/database/node_modules/@aktflow/contracts
./packages/database/node_modules/@aktflow/domain
./packages/domain/node_modules/@aktflow/contracts
./packages/testing/node_modules/@aktflow/contracts
$ wc -l < "$SCRATCH/aktflow-links.txt"
      16
```

**`apps/landing` has an `@aktflow/ui` link and still typechecks clean** — which is the
same point the `--listFiles` count makes, from the other direction: the compiler is not
reading `packages/ui` under either name.

Mirroring all sixteen for `@goproceed`, with each link's target copied verbatim from its
`@aktflow` twin:

```
$ while read -r l; do
    g="${l/@aktflow/@goproceed}"
    if [ -e "$g" ] || [ -L "$g" ]; then echo "PRE-EXISTING (left alone): $g"; continue; fi
    mkdir -p "$(dirname "$g")"; ln -s "$(readlink "$l")" "$g"; echo "$g" >> "$SCRATCH/created-links.txt"
  done < "$SCRATCH/aktflow-links.txt"
PRE-EXISTING (left alone): ./packages/testing/node_modules/@goproceed/contracts
    created by me: 15
```

Fifteen created; the sixteenth is Task 1's, left untouched. Then:

```
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "error TS" | sort) > "$SCRATCH/appapp-head-full.txt"
$ wc -l < "$SCRATCH/appapp-head-full.txt"
     137
$ grep -oE "error TS[0-9]+: Cannot find module '[^']+'" "$SCRATCH/appapp-head-full.txt" | sort | uniq -c
   2 error TS2307: Cannot find module 'zod'
   1 error TS2307: Cannot find module 'exceljs'
$ diff "$SCRATCH/appapp-base.txt" "$SCRATCH/appapp-head-full.txt" && echo "IDENTICAL ERROR SETS — byte for byte"
IDENTICAL ERROR SETS — byte for byte
```

Where `appapp-base.txt` is the same command run at `d59fa17` in the detached checkout —
**137 errors there too, the same 137 lines, in the same order.** Not one
`@goproceed/*` module is unresolved. The only unresolved modules at both ends are `zod`
and `exceljs`, the stale-install gap that predates this branch.

**That is a genuine differential proof that the rename did not break `apps/app`.** Same
41 files renamed, same error set as before the slice began. And with the same links in
place the whole set behaves:

```
$ for d in apps/demo apps/landing packages/testing packages/tokens packages/contracts apps/app packages/database packages/domain; do
    printf "%-20s " "$d"; (cd "$d" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
  done
apps/demo            0
apps/landing         0
packages/testing     0
packages/tokens      0
packages/contracts   0
apps/app             137
packages/database    6        # matches the plan's documented baseline
packages/domain      7        # all exceljs
```

**What this is not.** It is *assisted* evidence. Fifteen symlinks were placed by hand
because this checkout cannot run `pnpm install`, and a hand-built resolution layer proves
the rename is internally consistent — not that pnpm will build the same layer.
`pnpm install --frozen-lockfile` remains the gate, and it remains unrun.

**Everything created was removed**, so no reader inherits a misleading half-state:

```
$ while read -r g; do rm "$g"; rmdir "$(dirname "$g")" 2>/dev/null; done < "$SCRATCH/created-links.txt"
$ find . -path '*/node_modules/@goproceed/*' -maxdepth 5 | sort
./packages/testing/node_modules/@goproceed/contracts
$ find . -path '*/node_modules/@aktflow/*' -maxdepth 5 -type l | wc -l
      16
$ (cd apps/app && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
277
$ git status --porcelain
?? .agents/
?? .gstack/
?? skills-lock.json
```

Only Task 1's link survives, all sixteen `@aktflow` links are intact, `apps/app` is back
to 277, and the tree is clean.

## The suite, the filter, and both validators

The one test that needs neither a database nor the missing package:

```
$ pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts
 ✓ src/token-fidelity.test.ts (5 tests) 87ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Five tests, matching the baseline slices 1 and 2 both recorded. **The count matters as
much as the colour** — a suite that silently drops a test also prints green.

**The filter is itself a check**, because pnpm resolves `--filter` against `package.json`
names. The negative direction is the one worth recording, since a filter that matched
nothing would have exited 0 in some pnpm versions and proven nothing:

```
$ pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts
No projects matched the filters in "/Users/akisliy/Downloads/GoProceed"
```

The old name is genuinely gone from pnpm's workspace graph, not merely absent from text.

```
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: OK
exit=0
$ python3 scripts/validate_package.py | tail -2
AktFlow package validation: PASS (required_artifacts=35, documents=1, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.
```

**Neither validator reads a package name.** Every one of the fifteen metrics is identical
to slice 2's record. They are here to show this slice broke nothing, not to show it did
anything — and the validator's own banner still reads `AktFlow package validation`,
which is product copy this slice deliberately does not touch.

### The one live mutation this slice left behind

Task 3 deleted a dead strip from `validate-canonical-docs.mjs` and kept a live one. **A
deletion justified by "this pattern matches nothing" is only as good as the proof that
the *other* pattern still matches something.** Mutated here rather than trusted:

```
$ grep -n 'const stripped' scripts/validate-canonical-docs.mjs
40:    const stripped = line.replace(/aktflow_[\w]+/g, "");
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: OK
exit=0

    # replace line 40 with `const stripped = line;`
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: 3 problem(s)
  - docs/architecture/data-model.md:44: active AktFlow branding outside legacy context
  - docs/architecture/data-model.md:45: active AktFlow branding outside legacy context
  - docs/architecture/data-model.md:46: active AktFlow branding outside legacy context
exit=1

$ cp "$SCRATCH/vcd-backup.mjs" scripts/validate-canonical-docs.mjs
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: OK
exit=0
$ git diff --stat scripts/validate-canonical-docs.mjs
(no output)
$ [ "$(git hash-object scripts/validate-canonical-docs.mjs)" = "$(git rev-parse HEAD:scripts/validate-canonical-docs.mjs)" ] && echo YES
YES
```

The mutation bit, on the three lines where `docs/architecture/data-model.md` names the
PostgreSQL roles. **The surviving strip is load-bearing precisely because the roles are
not being renamed.** The restore is proven by blob hash, not by an absence of complaints.

## The boundary

The rename's whole safety argument is that its pattern is anchored to ten literal package
names and fenced out of six directories. Both halves are checked.

### Five directories are byte-identical, by tree hash

Stronger than a diff filter, which can only report what it was asked about:

```
$ for d in supabase technical prototype docs/legacy migration; do
    b=$(git rev-parse "d59fa17:$d"); h=$(git rev-parse "HEAD:$d")
    printf "%-14s %s\n" "$d" "$([ "$b" = "$h" ] && echo "IDENTICAL TREE ($b)" || echo DIFFERS)"
  done
supabase       IDENTICAL TREE (a8a5efc79b75282c5432769b178e00ff8801c517)
technical      IDENTICAL TREE (f4ab55113f1a7ef06706116cdcf429cc92898a12)
prototype      IDENTICAL TREE (79f27f9ca539254051724167370fb7bd66c0f9a3)
docs/legacy    IDENTICAL TREE (3473408cc54eabdc866a45808f1fe2512b222f42)
migration      IDENTICAL TREE (7ab3cb8aed56dae5d53e69b8731dcd4999f70b9f)
$ git diff --name-only d59fa17..HEAD | grep -E '^(supabase|technical|prototype|docs/legacy|migration)/'
(no output)
```

**Not one byte moved under any of them.** The five roles live overwhelmingly in
`supabase/migrations/`; that tree hash is the whole claim about them in one line. The four
role-shaped `technical/` names and the two CSV column headers
`scripts/validate_package.py` asserts by name are covered by `technical/`'s hash.

### No protected identifier was renamed

The naive comparison is contaminated, and the contamination is worth showing because it
is the trap this record family has now hit five times:

```
$ for s in aktflow_app aktflow.com AKTFLOW_BASE_URL aktflow-product-prototype; do
    b=$(git grep -oF "$s" d59fa17 -- . | wc -l); a=$(git grep -oF "$s" HEAD -- . | wc -l)
    printf "%-28s base=%-6s head=%-6s %s\n" "$s" "$b" "$a" "$([ "$b" = "$a" ] && echo SAME || echo '*** CHANGED ***')"
  done
aktflow_app                  base=1643   head=1652   *** CHANGED ***
aktflow.com                  base=29     head=33     *** CHANGED ***
AKTFLOW_BASE_URL             base=1      head=4      *** CHANGED ***
aktflow-product-prototype    base=3      head=6      *** CHANGED ***
```

Every one of those increases is **this slice's own design and plan documents describing
the strings they promise not to touch.** Excluding the paperwork:

```
$ for s in aktflow_app aktflow_app_login aktflow_worker aktflow_service aktflow_service_login \
           aktflow_platform_billing aktflow_support aktflow_external aktflow_audit_writer \
           aktflow_requirement aktflow_control aktflow.app aktflow.com aktflow.example aktflow.pilot \
           AKTFLOW_CHROME_PATH AKTFLOW_BASE_URL aktflow-product-prototype; do
    b=$(git grep -oF "$s" d59fa17 -- . ':!docs/superpowers/' | wc -l)
    a=$(git grep -oF "$s" HEAD    -- . ':!docs/superpowers/' | wc -l)
    printf "%-28s %-8s %-8s %s\n" "$s" "$b" "$a" "$([ "$b" = "$a" ] && echo SAME || echo '*** CHANGED ***')"
  done
aktflow_app                  1438     1439     *** CHANGED ***
aktflow_app_login            53       54       *** CHANGED ***
aktflow_worker               56       57       *** CHANGED ***
aktflow_service              59       61       *** CHANGED ***
aktflow_service_login        29       30       *** CHANGED ***
aktflow_platform_billing     18       18       SAME
aktflow_support              9        9        SAME
aktflow_external             6        6        SAME
aktflow_audit_writer         3        3        SAME
aktflow_requirement          2        2        SAME
aktflow_control              2        2        SAME
aktflow.app                  3        3        SAME
aktflow.com                  21       21       SAME
aktflow.example              8        8        SAME
aktflow.pilot                5        5        SAME
AKTFLOW_CHROME_PATH          6        7        *** CHANGED ***
AKTFLOW_BASE_URL             1        2        *** CHANGED ***
aktflow-product-prototype    3        3        SAME
```

**The four role-shaped `technical/` names, the two CSV column headers, all four domains
and `aktflow-product-prototype` are byte-for-byte unchanged.** The seven that moved all
resolve to two documentation edits, and the whole delta is visible in three lines:

```
$ git diff d59fa17..HEAD -- . ':!docs/superpowers/' | grep -E '^[+-][^+-]' | grep -E 'aktflow_[a-z]+'
-// aktflow_app) are runtime names handled by the v0.0 rename gate, not doc
+// (aktflow_app, aktflow_app_login, aktflow_worker, aktflow_service,
+// aktflow_service_login) are runtime names, not doc branding, and are not
$ git grep -nF 'AKTFLOW_BASE_URL' HEAD -- . ':!docs/superpowers/'
HEAD:TODOS.md:340:- Two env vars: `AKTFLOW_CHROME_PATH`, `AKTFLOW_BASE_URL`.
HEAD:prototype/qa/verify.mjs:26:const base = process.env.AKTFLOW_BASE_URL || `http://127.0.0.1:${server.address().port}`
```

One rewritten comment in `scripts/validate-canonical-docs.mjs` that now names all five
roles instead of one, and one new `TODOS.md` line that names the two env vars. **Both are
mentions added by this slice's own documentation. Not one use site changed.** The
`aktflow_app` count rises by exactly 1 and `aktflow_service` by exactly 2 because
`aktflow_app_login` and `aktflow_service_login` contain them as substrings — which is
itself a reminder that a substring count is not an identifier count.

### `ci.yml` — the file that mixes both worlds

The three role sites survive at the same line numbers with the same bytes:

```
$ diff <(git show d59fa17:.github/workflows/ci.yml | grep -n 'aktflow_') \
       <(git show HEAD:.github/workflows/ci.yml    | grep -n 'aktflow_') && echo "IDENTICAL"
IDENTICAL
$ git show HEAD:.github/workflows/ci.yml | grep -n 'aktflow'
22:      APP_DB_URL: postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres
25:      SERVICE_DB_URL: postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres
65:      # Dev-only password for aktflow_app_login — set by a local-host-only
```

**Exactly three surviving `aktflow` hits in the workflow, all role names in connection
strings.** Every package-name site moved. And the YAML did not reshape:

```
$ python3 -c "
import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml'))
print('jobs:', list(d['jobs']))
for j,v in d['jobs'].items(): print(f'  {j}: {len(v[\"steps\"])} steps')"
jobs: ['verify', 'demo-qa', 'package-validate']
  verify: 12 steps
  demo-qa: 14 steps
  package-validate: 5 steps
```

Identical at `d59fa17`. Three jobs, 12/14/5 steps, before and after.

### Zero live `@aktflow/` package references

The slice's headline check:

```
$ git ls-files | xargs grep -n '@aktflow/\(app\|demo\|landing\|mobile\|contracts\|database\|domain\|testing\|tokens\|ui\)' \
    | grep -v '^docs/superpowers/'
(no output)
$ git ls-files '*package.json' | xargs grep -n '@aktflow/'
(no output)
$ git ls-files '*package.json' | wc -l
      12
```

**Not one of the twelve `package.json` files — eleven workspace projects plus
`prototype/` — declares or depends on an `@aktflow/*` name.** Every surviving `@aktflow/`
string in the repository is in the planning archive, plus exactly one line of prose:

```
$ git ls-files | xargs grep -n '@aktflow/' | grep -v '^docs/superpowers/'
TODOS.md:323:(`@aktflow/*` → `@goproceed/*`, 10 `package.json` files and the source files
```

A wildcard in a sentence describing the rename that happened. It names no package.

### The root name and the CSS class

```
$ head -3 package.json
{
  "name": "goproceed",
  "private": true,
$ grep -n '^\s*\.goproceed-app\s*{' apps/demo/src/styles/theme.css
251:  .goproceed-app {
$ git ls-files | grep -v '^docs/superpowers/' | xargs grep -ln 'aktflow-app'
TODOS.md
```

The definition sits at `theme.css:251`, where `.aktflow-app` was. The only surviving
mention of the old class outside the planning archive is `TODOS.md:324`, prose recording
what this slice moved — it was absent at `d59fa17` and added by Task 3, so it is a
description of the rename, not a stranded usage. Thirteen files use the new class — the
eleven the plan predicted, plus this slice's own plan and design, which the fence
excludes — and again the count has to exclude this record, which names the class and
would otherwise make it fourteen:

```
$ R='^docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate\.md$'
$ git ls-files | grep -vE "$R" | xargs grep -l 'goproceed-app' | wc -l
      13
```

## Four counting errors in this slice's own paperwork

**These are the most useful thing in this record.** All four were caught by implementers
or by this task refusing to force a number to match a brief. Three are the controller's.

### 1. Task 1's commit is 64 files, not the 65 the brief stated

The brief said 63 by substitution + `ci.yml` + `pnpm-lock.yaml`. The lockfile is
*already inside* the 63-file fence match, so it was counted twice. Settled by set
identity rather than arithmetic — the pristine fence is re-derived at Task 1's parent
commit in an extracted tree, so nothing in the working checkout is touched:

```
$ git archive e88aeb2 | tar -x -C "$SCRATCH/tree-e88aeb2"
$ (cd "$SCRATCH/tree-e88aeb2" && find . -type f | sed 's|^\./||' \
     | grep -vE '^(docs/legacy|docs/superpowers|migration|supabase|technical|prototype|\.git)/' \
     | grep -v '^\.github/workflows/ci\.yml$' \
     | xargs grep -lE '@aktflow/(contracts|database|domain|testing|tokens|ui)\b' | sort) > "$SCRATCH/fence63.txt"
$ wc -l < "$SCRATCH/fence63.txt"
      63
$ grep -c '^pnpm-lock.yaml$' "$SCRATCH/fence63.txt"
1
$ { cat "$SCRATCH/fence63.txt"; echo ".github/workflows/ci.yml"; } | sort > "$SCRATCH/expected64.txt"
$ git show --name-only --format= 74ba335 | grep . | sort > "$SCRATCH/commit64.txt"
$ diff "$SCRATCH/expected64.txt" "$SCRATCH/commit64.txt" && echo "IDENTICAL SETS"
IDENTICAL SETS
```

Task 1's implementer reported 64 and explained it rather than hunting for a 65th file.

### 2. The "89 product-copy occurrences" is 99, and the error is exactly reconstructible

The design's scope table, its Out of scope section and the plan's Global Constraints all
say **89**. The controller's ledger already records this as its own error; what it could
not do is show where the number came from. It is fully recoverable.

The tally was produced by a greedy tokenizing regex, whose rows are *token* counts, not
substring counts. Re-run at the slice base:

```
$ (cd "$SCRATCH/tree-d59fa17" && find . -type f | sed 's|^\./||' \
     | grep -vE '^(docs/legacy|docs/superpowers|migration|\.git)/' \
     | xargs grep -oiE '[@a-z0-9_.-]*aktflow[@a-z0-9_./-]*' | sort | uniq -c | sort -rn) > "$SCRATCH/tok.txt"
$ awk '$2 ~ /AktFlow/ {split($2,a,":"); if (a[2] != "AktFlow") print}' "$SCRATCH/tok.txt"
   1 technical/openapi.yaml:LicenseRef-AktFlow-Proprietary
   1 scripts/validate-canonical-docs.mjs:AktFlow/i.test
   1 prototype/src/pages/Variations.jsx:AktFlow.
   1 prototype/src/pages/ResetPassword.jsx:AktFlow.
   1 prototype/src/pages/Login.jsx:AktFlow.
   1 prototype/src/pages/Field.jsx:AktFlow.
   1 prototype/src/components/AppShell.jsx:AktFlow.
        their sum: 7
$ awk '$2 ~ /AktFlow/ {s+=$1} END {print s}' "$SCRATCH/tok.txt"
96
```

**96 − 7 = 89.** Seven occurrences where `AktFlow` is glued to a neighbouring character —
a trailing full stop, a licence identifier, a regex `.test` call — formed their own rows,
and the single row reading `AktFlow` was read as if it were the substring total.

Measured properly, and this is the number to carry forward:

```
$ git ls-files | grep -vE '^(docs/legacy|docs/superpowers|migration)/' | xargs grep -oF 'AktFlow' | wc -l
      99
$ git ls-files | grep -vE '^(docs/legacy|docs/superpowers|migration)/' | xargs grep -lF 'AktFlow' | wc -l
      41
$ git ls-files | grep -vE '^(docs/legacy|docs/superpowers|migration)/' | xargs grep -oiF 'aktflow' | wc -l
     665
```

**99 occurrences of the substring `AktFlow` across 41 files** — tracked files, excluding
`docs/legacy/`, `docs/superpowers/` and `migration/`. **665** case-insensitively across
every `aktflow` form under the same fence. This number needs no self-exclusion: its fence
already covers `docs/superpowers/`, which is where this record lives, and it reads 99 both
before and after this record was committed.

**The rule is part of the number.** The same corpus yields **96** at the slice base,
**89** under the tokenizer reconstructed above, **284** with only `migration/` excluded,
and **287** genuinely unfenced:

```
$ R='^docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate\.md$'
$ git ls-files | grep -vE "$R" | xargs grep -oF 'AktFlow' | wc -l
     287
$ git ls-files | grep -vE "$R" | grep -v '^migration/' | xargs grep -oF 'AktFlow' | wc -l
     284
```

**As first committed at `7cdc3d0` this sentence called 284 "unfenced". It is not** —
284 is that commit's count with `migration/` excluded, and unfenced is 287. Naming a
count without its rule is the defect this very sentence exists to condemn, and it
mislabelled one of its own four examples. Found by the whole-branch review.

The rise from 96 to 99 is not product copy appearing. It is one file:

```
$ git diff d59fa17..HEAD --name-only -- . ':!docs/superpowers/' | while read -r f; do
    b=$(git show "d59fa17:$f" 2>/dev/null | grep -oF 'AktFlow' | wc -l)
    h=$(git show "HEAD:$f"    2>/dev/null | grep -oF 'AktFlow' | wc -l)
    [ "$b" != "$h" ] && printf "  %-40s %s -> %s\n" "$f" "$b" "$h"
  done
  TODOS.md                                 0 -> 3
```

Task 3's rewritten entry, naming the brand it says has not moved. **Zero user-visible
strings changed.**

### 3. `TODOS.md`'s 46 and 58 are 77 and 71 — and the docs number grew

Task 3 re-measured rather than adjusting by arithmetic, and both reproduce:

```
$ git ls-files | xargs grep -lE '\baktflow_app_login\b|\baktflow_app\b|\baktflow_service_login\b|\baktflow_service\b|\baktflow_worker\b' | wc -l
      77
$ git ls-files -- 'docs/*' 'technical/*' | xargs grep -liE 'aktflow' | wc -l
      71
      (63 under docs/, 8 under technical/)
```

**The document count grew, from 58 to 71**, which is the opposite of what a reader would
predict from three slices of archival work. Archiving relocates a mention; it does not
remove it. Slices 0–2 moved documents into `docs/legacy/`, which is still under `docs/`.

**Both numbers are as-of `3a8a8c5` and both go stale on the commit that adds this
record**, because this record names the five roles and lives under `docs/`. Under a rule
that excludes this directory they are stable at **75** and **64**:

```
$ git ls-files | grep -v '^docs/superpowers/plans/evidence/' | xargs grep -lE '\baktflow_app_login\b|\baktflow_app\b|\baktflow_service_login\b|\baktflow_service\b|\baktflow_worker\b' | wc -l
      75
$ git ls-files -- 'docs/*' 'technical/*' | grep -v '^docs/superpowers/plans/evidence/' | xargs grep -liE 'aktflow' | wc -l
      64
```

**`TODOS.md`'s 77 and 71 will read 78 and 72 the moment this record lands.** That is not
an error in Task 3's measurement; it is a count whose corpus includes the documents that
describe it. Nobody in this slice noticed it, and it is recorded here so the next reader
does not treat the drift as a regression.

### 4. `apps/app` is 41 of Task 1's 64 files, not 42

The controller's ledger and this task's own instructions say 42:

```
$ git show --name-only --format= 74ba335 | sed 's#/[^/]*$##' | cut -d/ -f1-2 | sort | uniq -c | sort -rn
  41 apps/app
   4 packages/tokens
   3 packages/database
   3 apps/mobile
   2 packages/ui
   2 packages/testing
   2 packages/domain
   2 packages/contracts
   2 apps/landing
   1 pnpm-lock.yaml
   1 infra
   1 .github/workflows
```

41 + 23 = 64. Immaterial to the argument — `apps/app` is still the dominant share and
still the part no local check reached — but this record's contract is that a stated
number is one somebody measured.

## Claims in this slice's own documents that do not reproduce

Recorded rather than corrected. The plan's Global Constraints forbid this task from
editing any document; a claim found here belongs in the record as an open item, never
smoothed into a file as though it had been fixed.

### The controller's `apps/app` ruling is wrong on its stated cause

Documented in full above. The ledger's **"the gap cannot be closed locally"** and its
diagnosis that `packages/contracts` "cannot resolve its own dependency, so its type
declarations never build" do not hold: with the resolution layer completed across sibling
packages, `apps/app` reproduces the slice base's 137-error set byte for byte and no
`@goproceed/*` module is unresolved. The ruling's *conclusion* — that `apps/app` is
unproven until CI's real install — still stands, and this record still says so. Its
*reason* was a per-package residue read as a global one.

### The design's role occurrence counts are line counts

The design's scope table says the five roles have "351 + 44 + 36 + 30 + 29 occurrences"
and the plan says "They appear 490 times". As raw occurrences that is not close:

```
$ for r in aktflow_app aktflow_app_login aktflow_worker aktflow_service aktflow_service_login; do
    printf "  %-24s %s\n" "$r" "$(git ls-files | xargs grep -ohE "\b$r\b" | wc -l)"
  done
  aktflow_app              1537
  aktflow_app_login        115
  aktflow_worker           74
  aktflow_service          74
  aktflow_service_login    69
                    sum: 1869
```

The numbers are right under a rule the design does not state — **matching lines, not
occurrences, and under the standard fence.** Both halves matter, and the base tree is
extracted so this is measured rather than inferred:

```
$ git archive d59fa17 | tar -x -C "$SCRATCH/tree-d59fa17"
$ for r in aktflow_app aktflow_app_login aktflow_worker aktflow_service aktflow_service_login; do
    case $r in
      aktflow_app) d=351;; aktflow_app_login) d=44;; aktflow_worker) d=36;;
      aktflow_service) d=30;; aktflow_service_login) d=29;;
    esac
    h=$(git ls-files | grep -vE '^(docs/legacy|docs/superpowers|migration)/' \
          | xargs grep -hE "\b$r\b" | wc -l | tr -d ' ')
    b=$(cd "$SCRATCH/tree-d59fa17" && find . -type f | sed 's|^\./||' \
          | grep -vE '^(docs/legacy|docs/superpowers|migration|\.git)/' \
          | xargs grep -hE "\b$r\b" | wc -l | tr -d ' ')
    printf "%-24s design=%-6s base=%-6s head=%s\n" "$r" "$d" "$b" "$h"
  done
aktflow_app              design=351    base=351    head=351
aktflow_app_login        design=44     base=44     head=45
aktflow_worker           design=36     base=36     head=37
aktflow_service          design=30     base=30     head=31
aktflow_service_login    design=29     base=29     head=30
        (sums: design 490, base 490, head 494)
```

**490 exactly, at the base.** The design's arithmetic is sound and its word is wrong;
`occurrences` should read `lines`. The head total is 494 for the reason given in the
boundary section — the four extra lines are the rewritten validator comment and the new
`TODOS.md` line, both mentions, neither a use site.

### `git grep` cannot be used for any of this

Not a claim in the paperwork, but the reason a first attempt at the table above returned
all zeros, and worth recording beside the `sed` trap because it is the same family:

```
$ git grep -hE '\baktflow_app\b' HEAD -- . | wc -l
       0
$ git ls-files | xargs grep -hE '\baktflow_app\b' | wc -l
    1534
```

**`git grep`'s bundled engine does not support `\b`.** It matches nothing and exits
cleanly. Task 1's implementer recorded this; it caught this record's author too.

### Everything else in Tasks 1–3's reports reproduced

Every command quoted in the three task reports that could be re-run at this commit was
re-run: the five typechecks at both ends, the lockfile structural check and its 9/0 key
counts, the `link:` diff, the `ci.yml` before/after and its three surviving role lines,
the YAML job/step counts, the five-test Vitest run, the `pnpm --filter` resolutions in
both directions, the role-strip mutation and its three named failures, the `77`/`71`
re-measurements, the four domains, the two env vars, the CSS definition at
`theme.css:251`, the root name, and the fence-leak checks. **Apart from the four counting
items and the `apps/app` ruling above, no claim in any of the three reports failed to
reproduce.**

## `\b` is a silent no-op in BSD `sed -E`, and the plan used it twice

**This is the most transferable thing in the slice.** The plan's substitutions were
written with GNU `\b` word boundaries. On this host they match nothing, `sed` exits **0**,
and every file is rewritten byte-identical.

```
$ sed --version 2>&1 | head -2
sed: illegal option -- -
usage: sed script [-EHalnru] [-i extension] [file ...]

$ echo 'import { x } from "@aktflow/contracts";' | sed -E 's#@aktflow/(contracts|database)\b#@goproceed/\1#g'
import { x } from "@aktflow/contracts";
    sed exit=0

$ echo 'import { x } from "@aktflow/contracts";' | sed -E 's#@aktflow/(contracts|database)[[:>:]]#@goproceed/\1#g'
import { x } from "@goproceed/contracts";
    sed exit=0
```

**The in-place form is the dangerous one**, because there is no output to notice:

```
$ printf 'import "@aktflow/contracts";\n' > "$SCRATCH/probe.ts"
$ shasum "$SCRATCH/probe.ts"
de2e8fb9753a5f17e51c78bc70094f5cc6344cc8
$ sed -i '' -E 's#@aktflow/(contracts)\b#@goproceed/\1#g' "$SCRATCH/probe.ts"; echo "exit=$?"
exit=0
$ shasum "$SCRATCH/probe.ts"
de2e8fb9753a5f17e51c78bc70094f5cc6344cc8
    IDENTICAL — sed exited 0 and changed nothing
```

The POSIX end-of-word operator `[[:>:]]` restores the semantics exactly, including the
negative case that makes a word boundary worth having:

```
$ printf '@aktflow/ui end\n@aktflow/uiKit must NOT match\n' | sed -E 's#@aktflow/(ui)[[:>:]]#@goproceed/\1#g'
@goproceed/ui end
@aktflow/uiKit must NOT match
```

**And the trap is specific to `sed`.** The same host's `grep -E` handles `\b` correctly,
which is why the discovery half of the plan's pipeline worked while the substitution half
silently did nothing:

```
$ echo 'import "@aktflow/contracts";' | grep -cE '@aktflow/(contracts)\b'
1
```

`git ls-files | xargs grep -lE …\b | tee file-list | xargs sed -i '' -E …\b` therefore
prints a plausible file list, reports a plausible count, exits 0, and changes **nothing**.

**It was caught only because the step checked a file count.** Had the plan asked "did
`sed` succeed", Task 1 would have committed a no-op, and Task 2 would then have
typechecked clean against six packages that were never renamed — because, as this record
establishes at length, four of those five typechecks cannot fail on this rename either.
**Two independent checks that cannot fail do not add up to one that can.**

Fixed in both plan patterns at `c717f9a`, before Tasks 2 and 3 inherited it. The design
is not edited; it is a point-in-time record.

## What this slice does **not** make true

`README.md:19` claimed before this slice that `AktFlow` "survives only as legacy
history". That was false then and would still be false now. Task 3 replaced it with a
sentence naming which half moved:

```
$ sed -n '19,21p' README.md
- **Product name is GoProceed.** The workspace package identifiers now say
  `@goproceed/*`; the five PostgreSQL roles and the user-visible `AktFlow`
  copy have not moved, and each is its own later slice.
```

Everything below is what that sentence is pointing at.

**The five PostgreSQL roles are untouched, and 77 files name them** — as of `3a8a8c5`;
see the drift note below, this record makes it 78. `aktflow_app`, `aktflow_app_login`,
`aktflow_worker`, `aktflow_service`, `aktflow_service_login` — 494 matching lines under
the standard fence, and **1,869 raw occurrences** repo-wide once this record excludes
itself, which it must, because it names the five roles 55 times:

```
$ R='^docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate\.md$'
$ tot=0; for r in aktflow_app aktflow_app_login aktflow_worker aktflow_service aktflow_service_login; do
    n=$(git ls-files | grep -vE "$R" | xargs grep -ohE "\b$r\b" | wc -l | tr -d ' ')
    printf "  %-24s %s\n" "$r" "$n"; tot=$((tot+n))
  done; echo "  sum: $tot"
  aktflow_app              1537
  aktflow_app_login        115
  aktflow_worker           74
  aktflow_service          74
  aktflow_service_login    69
  sum: 1869
```

Unscoped the sum is 1,924. They are excluded by a standing owner ruling: `ALTER ROLE … RENAME TO` clears an md5-hashed
password, every connection string and CI secret must move in the same window, and the
migration runs against an environment whose app is already connected under the old name.
That is a deployment-ordering problem with its own rollback story, not a substitution.
`supabase/`'s tree hash is identical, and `ci.yml` lines 22, 25 and 65 still carry the
roles inside connection strings — deliberately.

**99 `AktFlow` product-copy occurrences remain across 41 files**, counted under the rule
stated above. Two of them, verified at their exact locations rather than quoted from the
design:

```
$ grep -rn 'AktFlow — вхід' apps/ | grep -v node_modules
apps/app/app/(auth)/login/page.tsx:4:      <h1>AktFlow — вхід</h1>
$ grep -rn 'AktFlow — демонстраційний прототип' apps/ | grep -v node_modules
apps/demo/index.html:10:    <title>AktFlow — демонстраційний прототип</title>
apps/demo/src/components/AppShell.tsx:396:              <span>AktFlow — демонстраційний прототип.</span>
```

A login heading and a demo title, both Ukrainian, both user-visible. **This is a question
about what a person should see, not about what compiles**, which is why it is a separate
slice: no tool can verify it, and mixing it with a mechanical refactor would mean neither
got the review it needs. The validator's own banner, `AktFlow package validation`, is in
the same set.

**The four domains are untouched**, and there are still exactly four. This record names
all four repeatedly, so it excludes itself — unscoped the same command reports
`11 / 38 / 13 / 13`, and the four extra hits per domain are these very paragraphs:

```
$ R='^docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate\.md$'
$ git ls-files | grep -vE "$R" | xargs grep -ohE 'aktflow\.[a-z]+' | sort | uniq -c
   8 aktflow.app
  33 aktflow.com
  10 aktflow.example
  10 aktflow.pilot
```

**The two env vars are untouched:**

```
$ git ls-files | xargs grep -ohE 'AKTFLOW_[A-Z_]+' | sort -u
AKTFLOW_BASE_URL
AKTFLOW_CHROME_PATH
```

**`aktflow-product-prototype` is untouched.** It is not an `@aktflow/*` package,
`prototype/` carries disposition `keep`, and no workspace depends on it:

```
$ grep -n '"name"' prototype/package.json | head -1
2:  "name": "aktflow-product-prototype",
```

**Nothing under `technical/` moved**, including the four role-shaped names
(`aktflow_platform_billing`, `aktflow_support`, `aktflow_external`,
`aktflow_audit_writer` — planned v2.9 roles) and the two CSV column headers
(`aktflow_requirement`, `aktflow_control`) that `scripts/validate_package.py` asserts by
name through `read_csv_contract(required_headers=…)`. Renaming a column would red the
build. `technical/`'s own slice needs a product ruling on whether the v2.9 contract is
retired before it can even be scoped.

**And no directory moved.** That is what kept the lockfile edit to nine keys:

```
$ git diff --name-status --diff-filter=R d59fa17..HEAD | wc -l
       0
$ git diff --name-status --diff-filter=AD d59fa17..HEAD -- . ':!docs/superpowers/'
(no output)
```

Zero renames, zero additions, zero deletions outside the paperwork. **Eighty-six pure
modifications.**

## Commits

**Ten, as of the commit that writes this revision**, counting from the slice's base
`d59fa17`. The count includes the commit that writes it, so it cannot be pasted from a
`git log … | wc -l` run beforehand — that command returned **eight** immediately before
the first issue of this record landed, and **nine** immediately before this revision:

```
$ git log --oneline d59fa17..HEAD | wc -l
       9        # before this revision's commit; ten after
```

**This is the one self-referential count in the record that did not go stale**, because
it was written as a prediction that the table below then makes checkable. The four that
did go stale were the ones nobody thought to treat this way.

**The counting rule:** commits reachable from the tip and not from `d59fa17`, the base
this branch was cut from — the same rule slices 1 and 2 used. The table below is the
re-derivable form: **the count is its row count**, and a reader who does not trust the
sentence can count the rows. Rows are in `git log --reverse` order, verified rather than
remembered.

| # | Commit | What | Files |
|---|---|---|---|
| 1 | `c42a36d` | design — the identifier half, and only that half | 1 |
| 2 | `b747d2f` | plan — three commits, one per dependency layer | 1 |
| 3 | `e88aeb2` | controller — `ci.yml` is only ever edited by hand, in every task | 1 |
| 4 | `74ba335` | **Task 1** — the six `packages/*` libraries, 41 of its files under `apps/app` | 64 |
| 5 | `c717f9a` | controller — `\b` is a silent no-op in BSD `sed`, and the plan used it twice | 1 |
| 6 | `e5af7b2` | **Task 2** — the four apps; `vercel.json` and six `ci.yml` sites | 12 |
| 7 | `d06f3c7` | controller — two more claims the rename falsified, both found mid-execution | 1 |
| 8 | `3a8a8c5` | **Task 3** — root name, CSS class, and three claims this slice made false | 15 |
| 9 | `7cdc3d0` | **Task 4** — this record, as first issued | 1 |
| 10 | *(this commit)* | whole-branch review fix round 1 — four unscoped counts that counted the record printing them; a "284 unfenced" that was fenced; three internal contradictions; and one line added to the design pointing here | 2 |

**The ordering is the safety argument.** `74ba335` renames the six libraries *and every
importer of them in one commit*, so no commit exists where a package answers to one name
while its importers use another. `e5af7b2` then renames the four apps, which nothing
depends on. Reversing them would produce a commit where `apps/*` declared
`@goproceed/*` dependencies that no package provided. **Each commit renames a package
completely — `name` field, every dependency entry, every import specifier, and its
lockfile key — which is why "the apps still say `@aktflow/*`" after Task 1 is a
consistent state rather than a broken one.**

Three of the ten commits are controller corrections to the plan, all found during
execution, none of them cosmetic: an unenforceable `ci.yml` rule, the `sed` no-op, and two
documents the rename falsified. **A plan that produced no corrections is usually a plan
nobody executed carefully.**

### The whole-branch review, and what it changed

**Zero Critical, one Important, six Minor**, approve and merge with the Important fixed.
No source behaviour changed; the fixes landed in this record and one line of the design.

The review independently reproduced the two claims this record leans hardest on. It
enumerated the sixteen `@aktflow` symlinks itself, mirrored them, typechecked `apps/app`
at both ends and got **two 137-error files hashing identically** — confirming the
overturned `apps/app` ruling by construction rather than by re-reading this record. And
it reproduced the `96 − 7 = 89` reconstruction exactly.

**The Important is the one worth carrying forward, and it is this record's own.** Four
counts here were derived from a corpus that includes this file, and one of them — the
`git diff --shortstat` — sat two lines above the paragraph explaining that the defence
against exactly this is to scope the command. All four are fixed at their own locations
above rather than collected here, each now either scoped or stamped with an as-of, and
each re-run *after* the commit that fixed it. **This record spent a section warning about
a failure mode and then supplied four fresh instances of it**, which is the strongest
evidence available that the warning is worth keeping.

Of the six Minor, three were internal contradictions where the record disagreed with
itself — fifteen metrics against sixteen, four tree hashes against a loop printing five,
and a "three that could not run" section covering three of four packages. **A document
that contradicts itself is a document where at least one number was not measured**, which
is why they are recorded rather than quietly corrected. The remaining three were the
`284`/`287` mislabel, the missing `packages/domain` case, and the design's lack of any
pointer to this record.

Two findings needed no change and are recorded so a later reviewer does not re-open them:
`packages/database`'s 6 → 2 is a local module-resolution artifact and the framing above
is correct; and Task 3's CSS substitution fence omits the `ci.yml` exclusion that Tasks 1
and 2 carry — a real hole in the plan text that caused no harm, because `ci.yml` contains
no `aktflow-app`. **The fences were supposed to be identical across all three tasks so
that a file appearing in one and not another is a signal; that property held by luck
rather than by construction in Task 3.**

### The whole diff

```
$ git diff --name-only d59fa17..HEAD -- . ':!docs/superpowers/' | wc -l
      86
$ git diff --shortstat d59fa17..HEAD -- . ':!docs/superpowers/'
 86 files changed, 217 insertions(+), 206 deletions(-)
$ git diff --name-status d59fa17..HEAD -- 'docs/superpowers/' ':!docs/superpowers/plans/evidence/'
A	docs/superpowers/plans/2026-08-03-rename-slice3-packages.md
A	docs/superpowers/specs/2026-08-03-rename-slice3-packages-design.md
```

**Eighty-six modified files, 217 insertions against 206 deletions** — the shape of a
rename, where almost every line out returns as a line in — **plus the design and the
plan.** All three commands exclude paperwork: the first two exclude
`docs/superpowers/` entirely, so no edit to the design, the plan, or this record can
move them; the third excludes only `docs/superpowers/plans/evidence/`, so it still
reports the design and plan while keeping this record out of its own result set.

**As first committed at `7cdc3d0`, the middle command was unscoped and this is the
defect the whole-branch review called Important.** It read:

```
$ git diff --shortstat d59fa17..HEAD
 88 files changed, 1111 insertions(+), 206 deletions(-)
```

which was true at `3a8a8c5` and false the instant it was committed: at `7cdc3d0` the
same command returns `89 files changed, 2429 insertions(+)` — 1111 plus this record's
own 1318 lines. **A number that counts the file printing it, pasted two lines above a
paragraph asserting that the defence is to scope the command.** The sentence was right
and the command beside it was not, which is worse than either alone, because a reader
checking the claim runs the command rather than reading the paragraph.

It was not the only one. Three further counts in this record were unscoped and
undisclosed, each now carrying an explicit exclusion of this file and each verified
after the commit that fixes it: the four domains, the roles' raw occurrence total, and
the count of files using the renamed CSS class. **So this record supplied four fresh
instances of the exact failure it was written to warn about** — bringing the family
total to at least nine, after slice 1's three and slice 2's one.

All nine share one shape: **a number or listing derived from a set that the act of
writing it enlarges.** Three defences work, in this order of preference:

1. **Scope the corpus so the record cannot be in it.** `':!docs/superpowers/'` for
   anything about the diff; an explicit exclusion of this file for anything counting
   strings, since the whole `evidence/` directory would also drop eight prior gate
   records and change the answer in the other direction — excluding the directory takes
   the domain counts to `6 / 31 / 10 / 10`, which is as wrong as `11 / 38 / 13 / 13`.
2. **Stamp an explicit as-of**, where scoping is impossible — as with `TODOS.md`'s 77
   and 71, which are properties of the whole tree by definition.
3. **Re-run every number after committing**, because the commit changes them again.
   Prediction is not a defence; slice 1 proved that twice and this record proved it a
   third time.

The tree was clean before and after every probe in this record:

```
$ git status --porcelain
?? .agents/
?? .gstack/
?? skills-lock.json
```

`.agents/`, `.gstack/` and `skills-lock.json` are user-added and untracked. No task in
this slice staged, committed, moved or deleted them.

## And CI has still not run

That is the first section of this record and it is the last item here, because it is the
thing a reader is most likely to assume.

Ten package names changed identity across 86 files. Nine lockfile keys were rewritten by
hand because `pnpm install` cannot run in this checkout. A deployment configuration that
no test executes now carries `--filter=@goproceed/demo`. **The first real check on any of
it — and the only check `apps/app` has ever had that did not depend on symlinks placed by
hand — happens in CI, on a run that has not been attempted across four slices.**
