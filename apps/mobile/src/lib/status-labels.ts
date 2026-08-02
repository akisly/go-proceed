// Reads the canonical Ukrainian labels at build time. The catalog is the single
// source (technical/copy-catalog.csv) and packages/testing's copy-catalog
// fidelity test guarantees every database-permitted state has one — so a
// missing key here means that test would already be red.
import labels from "./status-labels.generated.json";

export type ClientState =
  | "not_sent" | "sending" | "awaiting_receipt"
  | "server_confirmed" | "failed" | "quarantined";

export function clientStateLabel(state: ClientState): string {
  const label = (labels as Record<string, string>)[`status.client_state.${state}`];
  if (!label) throw new Error(`no Ukrainian label for client_state ${state}`);
  return label;
}
