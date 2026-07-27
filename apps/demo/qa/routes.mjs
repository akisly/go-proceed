/**
 * Single source of truth for the apps/demo route contract.
 * Imported by tests/routes.test.ts AND qa/verify.mjs so the two can never drift.
 */
export const SHIPPED_ROUTES = [
  '/', '/demo', '/app', '/app/work', '/app/evidence',
  '/app/rules', '/pilot', '/roadmap', '/legal/privacy', '/legal/terms',
]

/** Never written into apps/demo. Every one must resolve to the /demo entry point. */
export const REDIRECTED_ROUTES = [
  '/login', '/reset-password', '/invite/demo', '/onboarding',
  '/app/billing', '/app/payments', '/app/variations', '/app/external-review',
  '/app/receivables', '/app/baseline', '/app/assignments', '/app/occurrence',
  '/app/field', '/app/close', '/app/packages', '/app/settings',
  '/app/team', '/review/demo',
]
