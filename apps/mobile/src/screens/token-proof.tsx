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
import { color, type ThemeName } from "@goproceed/tokens";
import { clientStateLabel, type ClientState } from "../lib/status-labels";

const STATES: ClientState[] = [
  "not_sent", "sending", "awaiting_receipt",
  "server_confirmed", "failed", "quarantined", "discarded",
];

// The token model became themed and semantic: `color` is now
// Record<ThemeName, Record<RoleName, string>>, and the flat primitives this
// screen used to name — `muted`, `slate-600`, `red-500`, `paper`, `ink-950`,
// `white` — no longer exist under those names (slate→neutral, red→danger, and
// the rest became roles). This screen pins ONE theme rather than following the
// device: it is a proof screen for the generated artifacts, so a fixed theme
// keeps what it renders comparable between runs.
const THEME: ThemeName = "light";

// Surface and foreground are taken as a PAIR from the same status role. The
// `status-*-surface` values are light tints (#EFEEEB … #FCE9E6 until the
// Autumn palette moved them on 2026-09-22; the line is illustrative and the
// code beside it reads the tokens), so the old
// single white label colour would have been unreadable on every row; each
// role's own `-fg` is the contrast the design system already worked out for it.
const TONE: Record<ClientState, { surface: string; fg: string }> = {
  not_sent: { surface: color[THEME]["status-idle-surface"], fg: color[THEME]["status-idle-fg"] },
  sending: { surface: color[THEME]["status-review-surface"], fg: color[THEME]["status-review-fg"] },
  awaiting_receipt: { surface: color[THEME]["status-review-surface"], fg: color[THEME]["status-review-fg"] },
  server_confirmed: { surface: color[THEME]["status-ready-surface"], fg: color[THEME]["status-ready-fg"] },
  failed: { surface: color[THEME]["status-blocked-surface"], fg: color[THEME]["status-blocked-fg"] },
  quarantined: { surface: color[THEME]["status-attention-surface"], fg: color[THEME]["status-attention-fg"] },
  discarded: { surface: color[THEME]["status-idle-surface"], fg: color[THEME]["status-idle-fg"] },
};

export function TokenProof() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Стани захоплення</Text>
      {STATES.map((s) => (
        <View key={s} style={[styles.row, { backgroundColor: TONE[s].surface }]}>
          <Text style={[styles.label, { color: TONE[s].fg }]}>{clientStateLabel(s)}</Text>
          <Text style={[styles.key, { color: TONE[s].fg }]}>{s}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color[THEME]["bg-canvas"] },
  content: { padding: 24, gap: 12 },
  heading: { fontSize: 22, color: color[THEME]["text-primary"], marginBottom: 8 },
  row: { padding: 16, borderRadius: 12 },
  // `color` is applied per row from TONE — each status carries its own
  // foreground, so it cannot be a static value here.
  label: { fontSize: 17 },
  key: { fontSize: 13, opacity: 0.8, marginTop: 4 },
});
