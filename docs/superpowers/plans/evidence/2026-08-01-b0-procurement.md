# v0.1-M2-B0 procurement record

**Date:** 2026-08-01
**Branch:** `claude/m2-b0-foundations`, from `main` @ `7728f47`
**Plan:** [2026-08-01-goproceed-v0.1-m2-b0-foundations.md](../2026-08-01-goproceed-v0.1-m2-b0-foundations.md)
**Spec:** [2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md](../../specs/2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md)

## What this record does not contain — read this before buying anything

**There are no costs, no lead times and no device models in this document, and
none should be inferred from it.** Every figure of that kind was deliberately
left out rather than estimated, because an invented number in a procurement
record is worse than a blank: it gets budgeted against. What each account
costs, what a plan tier includes, how long an Apple organisational enrolment
or a D-U-N-S registration actually takes, and what any recovery process
requires must all be confirmed directly with Apple, Google, Expo and Dun &
Bradstreet before anyone commits money or a date. This record's claim is only
that these items exist, that they are required, and that they are not yet
started.

The device floor is not specified here either. It is set in
`docs/decisions/ADR-004-roadmap-demo-and-documentation.md:76-78` — iOS 16.4+
and Android 10+, with the actual pilot-device inventory required to confirm
that floor before M2 UX freeze. (The floor sentence begins at `:76`; a
single-line citation of `ADR-004:77` lands on the inventory requirement in the
middle of it, not on the floor itself.) This record does not restate those
versions, and no device model in any price range has been selected — only the
*shape* of what is needed, one supported iPhone and one lower-resource
supported Android device, both physical.

## The device-install step is NOT DONE

`apps/mobile/eas.json` now carries the build profiles B0's exit gate needs,
but nothing has been built or installed on a device, and nothing in this
slice or the next can substitute for the procurement itself. It is blocked
on the three accounts and the two devices below, in that order: the
accounts have the longer lead time, and the devices cannot be meaningfully
used for signed internal-distribution builds without them. This is written
down rather than left implicit, the same way the M2-A gate record wrote
down the evidence purge worker that migration `0021` scheduled the marking
for but nothing runs.

No EAS command has ever successfully resolved `apps/mobile/eas.json`. A
first run, while this file still pinned a guessed `cli.version` floor of
`>= 16.0.0`, exited 1 before contacting Expo at all — the only CLI available
in this environment, `eas-cli@7.3.0` (global), is older than that guessed
floor (see "Why `eas.json` pins no CLI version floor, but does pin
`appVersionSource`" below). With that
floor removed, a second run of
`pnpm --filter @aktflow/mobile exec eas config --platform android --profile preview`
got further: it printed "EAS project not configured" and tried to prompt
"Would you like to automatically create an EAS project for
@akisliy/mobile?" — then exited 1 on its own because stdin was not
readable, without an answer being given and without creating anything. That
prompt is exactly the boundary this task is not allowed to cross: answering
it would create a project on Expo's servers, which requires the Expo
account this record says does not exist. So the file has been checked by
reading it against the documented EAS Build config schema — every key is a
recognized, correctly-shaped member of that schema, and the JSON is
syntactically valid — which is verification by inspection, not by a
completed execution. The first person with an Expo account should run the
same command and answer that prompt (or run `eas init` deliberately) before
relying on these profiles for an actual build.

## Three accounts, not two

Shipping a build to a device needs three separate accounts, and none of the
three exists yet. An Apple Developer Program membership is required to sign
and distribute an iOS build even for internal testing. A Google Play Console
account is required for the Android upload track. Neither is optional, and
neither substitutes for the other. The third is easy to miss because it looks
like tooling rather than a store: EAS build and submit jobs run on Expo's
infrastructure and are a paid service metered in build minutes, so an Expo
account with a funded plan is a procurement item in its own right, not a
detail of the CLI.

**Correction to an earlier draft of this record.** This section previously
claimed that "no document in this repository's product or technical corpus
names any of the three". That is false, and a reviewer showed it. The corpus
names all three systems and explicitly gates pilot delivery on the store
accounts:

- `docs/decisions/ADR-004-roadmap-demo-and-documentation.md:82-84` — pilot
  builds use TestFlight and the Google Play internal-testing track "when the
  store accounts are ready".
- `docs/architecture/system-overview.md:293-295` — the same gate, in the
  security/credential boundary section.
- `docs/architecture/system-overview.md:193-194` — names "Vercel, Expo, Apple,
  and Google" as external processors/distribution systems.
- `docs/product/roadmap.md:108-109` and
  `docs/product/scope-and-boundaries.md:88` — EAS internal preview builds and
  TestFlight/Google Play internal pilot distribution are both in v0.1 scope.
- `docs/delivery/version-0.1.md:65` — EAS internal build evidence is named as
  closing evidence for v0.1.

The real gap is narrower, and it is the one procurement actually needs. No
document says **who holds** any of the three accounts, **what any of them
costs**, **how long enrolment takes**, or **what the recovery path is** if
access to one is lost. The corpus establishes that these accounts are required
and stops there. "When the store accounts are ready" is a dependency, not a
schedule, and nothing in the repository turns it into one. That is what this
record exists to say.

## The long-lead item

Apple's organisational enrolment — the kind a legal entity uses, rather than
an individual developer account — requires a D-U-N-S number for that entity.
A D-U-N-S number is obtained through Dun & Bradstreet, separately from Apple
and on Dun & Bradstreet's own timeline, before the Apple enrolment can even be
submitted.

Outside this slice's own documents, nothing in this repository mentions it.
`grep -rinE 'd-u-n-s|duns'` over the whole tree returns hits in exactly three
places, all of them written by this slice: this record, the slice's plan
(`docs/superpowers/plans/2026-08-01-goproceed-v0.1-m2-b0-foundations.md:946,979`)
and the slice's design spec
(`docs/superpowers/specs/2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md:208`).
No product, architecture, ADR or operations document names it, and none of the
three that do carries a lead time, a cost, or who would file for it. (An
earlier draft of this record said "nothing in this repository mentions it",
which was overbroad — the slice's own plan and spec do.)

Of everything this record lists, it is the one with the longest lead time, and
it is upstream of the Apple account rather than a step inside it, so it is the
first of the three account items to start, not the first to finish.

## The signing-key item — recoverable, but not on your schedule

The Android upload keystore is the private key used to sign every build
submitted to Google Play.

**Correction to an earlier draft of this record.** This section previously
said that if the upload keystore is lost "there is no recovery path that keeps
the same app listing", and it was headed "the unrecoverable item". That is
wrong, and it was the claim driving the escrow recommendation below. Under
**Play App Signing** — which Google holds the app signing key for, and which
is the default and effectively required path for new apps — the upload key is
*not* the app's identity. Losing an upload key means requesting an upload key
reset from Google and registering a new one; the app signing key, the app
listing, and every installed copy's update path are unaffected. The genuinely
unrecoverable case is the legacy one: an app that self-manages its signing key
outside Play App Signing. Losing *that* key does end the ability to update the
existing listing. A new app enrolling in Play App Signing, which is what this
milestone will be doing, is not in that case. The slice's plan
(`docs/superpowers/plans/2026-08-01-goproceed-v0.1-m2-b0-foundations.md:948,980`)
and design spec
(`docs/superpowers/specs/2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md:213-216`)
carry the same overstatement, inherited from this record; this correction
supersedes them.

**The escrow recommendation stands, on the real risk rather than the
overstated one.** An upload key reset is a support round trip with Google:
it requires proving identity to Google's satisfaction and takes however long
Google takes, and until it completes, no release can ship to the existing
listing at all. That is a release freeze of unknown duration on a key that one
person holds — which is precisely the failure mode the continuity section
exists to prevent, and it does not need the key to be unrecoverable to be
worth escrowing. The same argument applies with more force to the account
credentials themselves: losing access to the Google Play or Apple Developer
*account* is a materially worse problem than losing a signing key, and this
record does not know what either recovery process requires.

`docs/26-sre-operations.md:145-154` is the solo-founder continuity section,
and it covers emergency contacts, credential escrow, domain and billing
ownership, and documented deploy and restore procedures — it does not name the
Android upload keystore or the store credentials generally as things that
continuity plan has to hold. (`grep -rin keystore docs technical` returns hits
in five files, not the two an earlier draft of this record claimed. Two
predate this slice and are the OS-level iOS Keychain / Android Keystore used
to wrap a per-file encryption key on the device — a different mechanism
entirely from the upload-signing keystore this section is about:
`docs/architecture/files-and-storage.md:134` and
`technical/database/invariant-catalog.csv:54`. The other three are this
slice's own documents: this record, the slice's plan, and the slice's design
spec. So the substantive point survives — no document that predates this slice
mentions the upload-signing keystore — but "two hits" was simply the wrong
number.) Whoever sets up the Google Play account needs to generate this key
and place it in the same escrow the continuity section already asks for,
before the first upload, not after.

## Two devices

The milestone's exit gate needs the preview profile installed on one
supported iPhone and one lower-resource Android device, both physical, not
simulators or emulators. This is not a convenience preference:
`docs/27-qa-traceability.md:137` states that camera and offline behaviour
cannot be signed off using an emulator only, and camera capture is the
feature this milestone exists to ship. Neither device is procured. The
roadmap also lists the actual pilot-device inventory as *entry* evidence for
M2 — required before capture UX is frozen, not something the milestone
produces along the way — and that inventory does not exist either, so this
gap predates B0 and was already open when this slice started.

## Why `eas.json` pins no CLI version floor, but does pin `appVersionSource`

The first draft of `apps/mobile/eas.json` set `cli.version` to `>= 16.0.0`.
That number was not derived from anything — not from Expo SDK 57, not from a
build that had actually succeeded, not from any compatibility note in this
repository. It was a guess, and the only thing it did was stop
`eas config` from running at all: the one CLI reachable in this environment
(`eas-cli@7.3.0`) is older than the guessed floor, so the command refused to
even attempt resolving the profiles, and the next person to run it with
whatever CLI they happen to have would hit the same wall for the same
unearned reason. A minimum CLI version belongs in this file once a build has
actually succeeded against SDK 57 and the floor reflects that evidence; until
then, a guessed floor only blocks the checks that would produce it.

**Two separate keys, two separate decisions — and an earlier draft conflated
them.** Removing the guessed floor was done by deleting the whole `cli` block,
which took `appVersionSource: "remote"` out with it. That second loss was not
noticed, not intended, and not recorded anywhere; both this record and the
gate record discussed only the version floor. A reviewer caught it. The `cli`
block is now restored carrying `appVersionSource` and nothing else:

```json
"cli": { "appVersionSource": "remote" }
```

The floor is absent **deliberately**: a version floor should come from a build
that succeeded, not from a guess, and a guessed one blocks the very checks
that would earn it.

`appVersionSource` is present **deliberately**, for the opposite reason: it
removes an ambiguity that changes what a build does to the working tree.
`apps/mobile/eas.json` sets `"autoIncrement": true` on the production profile,
so the first production build increments a version against whichever source is
in effect — and with the key absent, that is whatever the runner's EAS CLI
happens to default to. Older CLIs default to a local source and increment by
**writing to `app.json` and the native project files**; newer ones default to
`remote` and increment a counter held on EAS's servers, touching nothing in
the repository. Which of those two things a build does to a developer's
checkout is not something to leave to the version of a CLI nobody has pinned.
Stating it explicitly costs one line and is orthogonal to the floor question:
it is not a guess about compatibility, it is a statement of intent about
where the build number lives.

The restored key carries the same caveat as the rest of this file, and it is
worth repeating rather than assuming the reader remembers: **no EAS command has
resolved it.** `cli.appVersionSource` was checked by reading it against the
documented EAS Build config schema — a recognized key, one of its two
documented values — and the file is still syntactically valid JSON. That is
verification by inspection, exactly as recorded above for the build profiles,
and it stays that way until someone with an Expo account runs the tool.
