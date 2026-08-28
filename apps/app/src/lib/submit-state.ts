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
 */
export type SubmitState = "idle" | "submitting" | "created" | "failed";
export type SubmitEvent = "submit" | "succeeded" | "failed" | "retry";

export function nextSubmitState(current: SubmitState, event: SubmitEvent): SubmitState {
  if (event === "submit" || event === "retry") {
    return current === "submitting" || current === "created" ? current : "submitting";
  }
  if (current !== "submitting") return current;
  return event === "succeeded" ? "created" : "failed";
}
