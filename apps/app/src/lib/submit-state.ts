/**
 * The submit lifecycle, as a value.
 *
 * Extracted so the re-entrancy guard is testable without a browser: «a second
 * press while the first is in flight must not fire a second request» is a
 * transition, and a transition can be asserted directly. The component holds
 * this in state and disables its control whenever the state is `submitting`;
 * the harness then proves the wiring against a real browser.
 *
 * `created` is terminal on purpose. The assignment exists; pressing again must
 * not send the same idempotency key at a body the server would treat as a
 * conflict.
 *
 * THERE IS NO `"retry"` EVENT, AND THERE USED TO BE ONE. It was code-identical
 * to `"submit"` — the same branch, the same result for every state — had no
 * dispatcher anywhere in the repository, and no test. Deleted in the final fix
 * wave, because this module's entire justification is that its transition table
 * is small enough to assert exhaustively, and an event nothing sends is a row
 * that makes the table look bigger than the behaviour it describes. A retry IS
 * a submit: `failed → submitting` is the transition that expresses it, and it
 * is tested.
 */
export type SubmitState = "idle" | "submitting" | "created" | "failed";
export type SubmitEvent = "submit" | "succeeded" | "failed";

export function nextSubmitState(current: SubmitState, event: SubmitEvent): SubmitState {
  if (event === "submit") {
    return current === "submitting" || current === "created" ? current : "submitting";
  }
  if (current !== "submitting") return current;
  return event === "succeeded" ? "created" : "failed";
}
