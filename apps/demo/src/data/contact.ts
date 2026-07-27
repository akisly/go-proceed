/**
 * The one monitored mailbox this deployment publishes.
 *
 * NOTE FOR EDITORS: qa/preflight.mjs matches the placeholder syntax — an
 * upper-case name in doubled curly braces — anywhere in a src/ file, comments
 * included. So this comment names the tokens it discusses WITHOUT their
 * braces. Writing one out in full here would make the deploy gate report this
 * file as carrying an unresolved placeholder, which is the opposite of what it
 * does. Only a real assignment awaiting a real value should ever carry the
 * braces.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO STRING LITERALS ─────────────────────────
 *
 * This value was the CONTACT_EMAIL placeholder token until it was resolved, and
 * it lived as an independent `const` in BOTH `src/pages/Legal.tsx` and
 * `src/pages/Pilot.tsx`.
 * Two copies of an unresolved token are harmless — a token is inert, and the
 * preflight gate (qa/preflight.mjs) fails on either copy, so they cannot
 * silently disagree. Two copies of a REAL address are not harmless: /pilot's
 * `mailto:` and /legal/privacy's deletion-request instructions must name the
 * same mailbox, and nothing mechanical would catch it if one were updated and
 * the other left behind. A visitor would then be told to write to an address
 * that is not the one their answers were actually sent to.
 *
 * So it is defined exactly once, here, and imported by both pages.
 *
 * ── WHAT «RESOLVED» MEANS ────────────────────────────────────────────────────
 *
 * The LAUNCH BLOCKER comments that used to sit at both definitions warned
 * against inventing a plausible-looking address or dropping in a personal one
 * as a stand-in. The failure they were guarding against is a specific one: a
 * deletion request arriving at a mailbox nobody reads. This address is the
 * project owner's own, actively monitored account, supplied by them for this
 * purpose — so the guarantee /legal/privacy makes on this page's behalf is one
 * that can actually be honoured. That, and only that, is what makes the token
 * resolved rather than bypassed.
 *
 * The FORM_PROCESSOR token (src/pages/Legal.tsx) remains genuinely unresolved,
 * so `pnpm --filter @aktflow/demo preflight` still exits 1. See README.md §3.
 */
export const CONTACT_EMAIL = 'akisliy2306@gmail.com'
