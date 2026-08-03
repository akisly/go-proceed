# v0.1-M2-B0 procurement record

**Date:** 2026-08-01
**Branch:** `claude/m2-b0-foundations`, from `main` @ `7728f47`
**Plan:** [2026-08-01-goproceed-v0.1-m2-b0-foundations.md](../2026-08-01-goproceed-v0.1-m2-b0-foundations.md)
**Spec:** [2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md](../../specs/2026-08-01-goproceed-v0.1-m2-b0-foundations-design.md)

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
floor (see "Why `eas.json` no longer pins a CLI version" below). With that
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
detail of the CLI. No document in this repository's product or technical
corpus names any of the three — the roadmap, the ADRs, and
`docs/26-sre-operations.md` all describe what the mobile client does once it
is built, not what has to be bought to build it.

## The long-lead item

Apple's organisational enrolment — the kind a legal entity uses, rather than
an individual developer account — requires a D-U-N-S number for that entity.
A D-U-N-S number is obtained through Dun & Bradstreet, separately from Apple
and on Dun & Bradstreet's own timeline, before the Apple enrolment can even be
submitted. Nothing in this repository mentions it. Of everything this record
lists, it is the one with the longest lead time, and it is upstream of the
Apple account rather than a step inside it, so it is the first of the three
account items to start, not the first to finish.

## The unrecoverable item

The Android upload keystore is the private key used to sign every build
submitted to Google Play. Google ties an app's identity on the Play Console to
whichever keystore first signed it; if that keystore is lost, there is no
recovery path that keeps the same app listing; publishing again means a new
app identity. `docs/26-sre-operations.md:145-154` is the solo-founder
continuity section, and it covers emergency contacts, credential escrow,
domain and billing ownership, and documented deploy and restore procedures —
it does not name the Android upload keystore or the store credentials
generally as things that continuity plan has to hold. (A search of `docs/`
and `technical/` for the word "keystore" does turn up two hits, in
`docs/architecture/files-and-storage.md` and
`technical/database/invariant-catalog.csv` — both are the OS-level iOS
Keychain / Android Keystore used to wrap a per-file encryption key on the
device, which is a different mechanism entirely from the upload-signing
keystore this section is about. Neither document mentions the upload
keystore.) Whoever sets up the Google Play account needs to generate this key
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

## Why `eas.json` no longer pins a CLI version

The first draft of `apps/mobile/eas.json` set `cli.version` to `>= 16.0.0`.
That number was not derived from anything — not from Expo SDK 57, not from a
build that had actually succeeded, not from any compatibility note in this
repository. It was a guess, and the only thing it did was stop
`eas config` from running at all: the one CLI reachable in this environment
(`eas-cli@7.3.0`) is older than the guessed floor, so the command refused to
even attempt resolving the profiles, and the next person to run it with
whatever CLI they happen to have would hit the same wall for the same
unearned reason. The `cli` block has been removed from `eas.json` entirely
rather than replaced with a different guess. A minimum CLI version belongs
in this file once a build has actually succeeded against SDK 57 and the
floor reflects that evidence; until then, a guessed floor only blocks the
checks that would produce it.
