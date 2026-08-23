/**
 * Ukrainian pluralisation and age formatting for D2's money screen.
 *
 * PORTED, NOT RE-DERIVED — `docs/design/02-building-ui.md` §6 says
 * `pluralUk`/`rowsUk` "already encode this at
 * `apps/demo/src/domain/format.ts:44` — port them, never re-derive them", and
 * that citation is now STALE: `git log --all -- apps/demo` shows commit
 * f85e25e ("chore: retire apps/demo and its CI job — the durable demo belongs
 * to apps/app") deleted `apps/demo/src/domain/format.ts` outright, and no
 * later commit ported it into `apps/app`. `apps/demo` does not exist in this
 * worktree (`ls apps/` — `app`, `landing`, `mobile`, checked before writing
 * this file). Per the docs-precedence rule this codebase already applies to
 * itself (`docs/README.md`, and this file's own header's earlier correction
 * about the Supabase key rename), a stale citation is recorded and corrected
 * rather than followed blind: `pluralUk` below is copied byte-for-byte from
 * `git show f85e25e~1:apps/demo/src/domain/format.ts`, the last commit before
 * deletion — not rewritten — so the porting instruction is honoured in
 * substance even though the source path it names is gone.
 */

/**
 * Ukrainian has three plural forms, and picking the wrong one is the kind of
 * error a non-native reviewer waves through and a native reader trips over
 * immediately.
 *
 *   one   1, 21, 31 … but NOT 11        — «1 рядок»
 *   few   2-4, 22-24 … but NOT 12-14    — «4 рядки»
 *   many  0, 5-20, 25-30 …              — «14 рядків»
 *
 * The teens are the trap: 11-14 all take `many` despite ending in 1-4, which is
 * why the check is on the last TWO digits and not just the last one.
 */
export function pluralUk(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count));
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = n % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** «1 день», «2 дні», «11 днів». */
export function daysUk(count: number): string {
  return `${count} ${pluralUk(count, "день", "дні", "днів")}`;
}

/**
 * A `blockedReason.since` timestamp (server time the block began — INV-073's
 * neighbour field, `packages/contracts/src/readiness.ts`'s `blockedReason.
 * since`) rendered as an age in whole days, never as a raw ISO datetime a
 * reader would have to do arithmetic on themselves.
 *
 * WHOLE DAYS, FLOORED, NEVER ROUNDED. A block that started six hours ago is
 * "заблоковано 0 днів" — true and legible — rather than rounding up to a day
 * that has not elapsed, which would overstate the age of every fresh block by
 * up to a full day.
 *
 * CLAMPED AT ZERO. `since` is server time and `now` is the reader's clock;
 * a negative age from clock skew between the two would print "-1 днів" and
 * is clamped rather than trusted, because a nonsense age is worse than a
 * slightly wrong one.
 */
export function daysSinceUk(since: string, now: Date = new Date()): string {
  const elapsedMs = now.getTime() - new Date(since).getTime();
  const days = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  return daysUk(days);
}
