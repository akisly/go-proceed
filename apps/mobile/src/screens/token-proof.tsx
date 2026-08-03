// Not decoration. This screen renders both generated artifacts, so it fails
// visibly if either generator never ran at all: a missing token throws at
// import, a missing label throws in clientStateLabel. That is the whole
// deliverable of this slice made observable on a device.
//
// What it does NOT catch, stated so nobody assumes otherwise: a STALE
// artifact. If technical/copy-catalog.csv changes and the label generator is
// not re-run, this screen renders the old wording with total confidence — a
// reviewer demonstrated exactly that. A screen can only show what an artifact
// says, never whether it still agrees with the source it came from. That
// comparison lives in packages/testing:
// status-label-fidelity.test.ts for status-labels.generated.json, and
// token-fidelity.test.ts for the two token artifacts.
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { color } from "@goproceed/tokens";
import { clientStateLabel, type ClientState } from "../lib/status-labels";

const STATES: ClientState[] = [
  "not_sent", "sending", "awaiting_receipt",
  "server_confirmed", "failed", "quarantined",
];

const SURFACE: Record<ClientState, string> = {
  not_sent: color["muted"],
  sending: color["slate-600"],
  awaiting_receipt: color["slate-600"],
  server_confirmed: color["signal-700"],
  failed: color["red-500"],
  quarantined: color["amber-500"],
};

export function TokenProof() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Стани захоплення</Text>
      {STATES.map((s) => (
        <View key={s} style={[styles.row, { backgroundColor: SURFACE[s] }]}>
          <Text style={styles.label}>{clientStateLabel(s)}</Text>
          <Text style={styles.key}>{s}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color["paper"] },
  content: { padding: 24, gap: 12 },
  heading: { fontSize: 22, color: color["ink-950"], marginBottom: 8 },
  row: { padding: 16, borderRadius: 12 },
  label: { fontSize: 17, color: color["white"] },
  key: { fontSize: 13, color: color["white"], opacity: 0.8, marginTop: 4 },
});
