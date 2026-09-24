// Ported from apps/app/src/lib/capture/attempt.ts, which DEV-035 deleted with the field PWA
// (2026-09-23): this copy is the only one now, so fix bugs here.

/**
 * A MONOTONICALLY INCREASING TOKEN THAT ANSWERS EXACTLY ONE QUESTION: is a
 * given past attempt still the one allowed to write state?
 *
 * Ported alongside `upload.ts`/`recover.ts` though not itself in this task's
 * file list: `src/screens/capture.tsx` needs it for the same reason
 * `apps/app`'s equivalent does — see that file's own header (fix round 2 on
 * its task 9) for the exact defect a component-scoped boolean produced
 * (a discarded photo's late callback overwriting the receipt of the photo
 * the foreman kept). Porting the screen without this class would silently
 * reintroduce that defect on this platform.
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
