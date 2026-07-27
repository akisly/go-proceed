/**
 * The literal token syntax this deployment uses for values that are not yet
 * finalised — today that is `{{FORM_PROCESSOR}}` (see the LAUNCH BLOCKER
 * comment in src/pages/Legal.tsx). Shared by tests/claims.test.ts (source
 * scan) and qa/verify.mjs (built-bundle scan), the same way
 * FORBIDDEN_CLAIM_PATTERNS in ./forbidden-claims.mjs is shared by both, so
 * the two guards can never drift out of sync with each other.
 *
 * This is a deploy-blocking gate, not a warning: a match is a FAILING
 * preflight run, by design — it is the last mechanical check standing between
 * an unreplaced token and a live page shipping something like a dead
 * `mailto:{{CONTACT_EMAIL}}` link to a real subcontractor.
 *
 * That example is not hypothetical: `{{CONTACT_EMAIL}}` was the second token
 * this guard was written for, and it is now RESOLVED — a real monitored
 * mailbox in src/data/contact.ts. `{{FORM_PROCESSOR}}` is not, so preflight
 * still fails today. That is the guard doing its job, not a bug in the guard
 * — do not weaken this pattern, exclude a file or route from either scan, or
 * replace a token with an invented placeholder-looking value merely to turn
 * it green. Only a real, deployment-ready value (or removing the sentence
 * that names it) should ever make this pass.
 */
export const PLACEHOLDER_TOKEN_PATTERN = /\{\{[A-Z_]+\}\}/

/** Same pattern, `g`-flagged, for extracting every distinct match rather than only testing for one. */
export const PLACEHOLDER_TOKEN_PATTERN_GLOBAL = new RegExp(PLACEHOLDER_TOKEN_PATTERN.source, 'g')
