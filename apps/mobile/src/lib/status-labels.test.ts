import { describe, it, expect } from "vitest";
import labels from "./status-labels.generated.json";
import type { ClientState } from "./status-labels";

/**
 * REGRESSION GUARD — the ClientState union must have exactly 7 members matching
 * the 7 keys in status-labels.generated.json that start with "status.client_state.".
 *
 * Dropping a state like "quarantined" (which happened in task 2) was invisible
 * to typecheck and tests because no test inspected the mapping. This assertion
 * enforces 1:1 correspondence: the union cannot drift from the generated labels
 * without this test failing.
 *
 * A 7-member union requires TWO kinds of exhaustiveness, not one:
 * (1) every ClientState key must have a label (a call-site TS check via the
 *     function signature), and (2) every label key must have a union member
 *     (which only a test can enforce — the type checker sees the label lookup
 *     as a Record<string, string> and does not know its actual keys).
 */

describe("ClientState union must match status-labels.generated.json exactly", () => {
  it("has a label for every state in the union, and no more", () => {
    // Extract all "status.client_state.*" keys from the generated labels
    const generatedKeys = Object.keys(labels).filter((k) => k.startsWith("status.client_state."));
    const generatedStates = generatedKeys.map((k) => k.replace("status.client_state.", "")).sort();

    // Exhaustiveness object: a const assertion that forces TypeScript to verify
    // that this object has exactly the keys of ClientState. If any key is missing
    // from the type, TS will error on the assignment.
    const unionMembers = {
      not_sent: true,
      sending: true,
      awaiting_receipt: true,
      server_confirmed: true,
      failed: true,
      quarantined: true,
      discarded: true,
    } as const satisfies Record<ClientState, true>;

    const unionStates = Object.keys(unionMembers).sort();

    expect(generatedStates).toEqual(unionStates);
    expect(generatedStates.length).toBe(7);
  });

  it("carries seven, not six or eight", () => {
    const generatedKeys = Object.keys(labels).filter((k) => k.startsWith("status.client_state."));
    expect(generatedKeys).toHaveLength(7);
  });
});
