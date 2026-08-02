// Not decoration. This screen renders both generated artifacts, so it fails
// visibly if either generator did not run: a missing token throws at import,
// a missing label throws in clientStateLabel. That is the whole deliverable of
// this slice made observable on a device.
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { color } from "@aktflow/tokens";
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
