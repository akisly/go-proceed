/**
 * A MONOTONICALLY INCREASING TOKEN THAT ANSWERS EXACTLY ONE QUESTION: is a
 * given past attempt still the one allowed to write state?
 *
 * FIX ROUND 2 ON TASK 9. Round 1's `discardedRef` was a single shared
 * boolean, scoped to the COMPONENT INSTANCE rather than to the ATTEMPT. That
 * answered "has ANY attempt been discarded" — the wrong question the moment
 * a second attempt starts: `handleFile` reset the boolean to `false` for the
 * new photo, which also re-armed the OLD, still-running upload's late
 * callback. A discarded photo's stale `onStateChange` could then drive the
 * visible progress, and — the evidence-integrity failure — its eventual
 * receipt (`contentHash`, `serverReceivedAt`) could land on screen attributed
 * to the photo the foreman actually kept.
 *
 * `AttemptGuard` closes this by making "is this callback still allowed to
 * write" a comparison between two INCOMPARABLE VALUES once a new attempt
 * exists, rather than a comparison against one shared flag that gets reset.
 * A token captured by an old closure can never equal a newer `#current`,
 * whether the newer attempt exists because of a retake or because of a bare
 * discard — both call sites bump the counter, so both close the same window.
 */
export class AttemptGuard {
  #current = 0;

  /** Starts a new attempt and returns the token that identifies it. */
  begin(): number {
    this.#current += 1;
    return this.#current;
  }

  /**
   * Ends the current attempt without starting a new one — a bare discard,
   * with nothing yet in flight to replace it. Any token captured before this
   * call stops being current; the very next `begin()` returns a fresh token
   * one further on, so a discard and a following retake are never mistaken
   * for the same attempt either.
   */
  supersede(): void {
    this.#current += 1;
  }

  /** True while `token` still names the in-progress (or most recently begun) attempt. */
  isCurrent(token: number): boolean {
    return token === this.#current;
  }
}
