// Routes only. Screen bodies live in src/screens — this directory is the route
// table and nothing else, so a file added here is a URL, not a component.
//
// `headerShown: false` is not styling. B0's deliverable is exactly what
// src/screens/token-proof.tsx renders, and the old entry (App.tsx) rendered it
// with no navigator chrome above it. A default Stack header would put a bar the
// screen never had on top of it, which would make the router migration change
// the deliverable. B1 adds real screens to this same Stack and decides its own
// header per route.
//
// THE OUTER `View` AND THE `InstallHint` BENEATH THE `Stack` — added with the
// install hint (docs/superpowers/plans/2026-08-21-install-hint.md), the first
// thing this layout renders alongside the Stack rather than instead of it.
// `InstallHint` is a non-modal bottom banner, mounted once here rather than
// per-screen (its own header explains why), and it must never cover a
// screen's own content — the OTP form's submit button on `/login` above all.
// Absolute-positioning it over the Stack was the tempting shortcut and the
// wrong one: it would sit on top of whatever the active screen last laid
// out, submit button included, exactly when a phone's keyboard has already
// shrunk the visible area the most. Making it a normal flex sibling instead
// — `flex: 1` on the wrapping `View`, `flex: 1` on the `Stack`'s own
// container, the banner last, with no explicit height of its own — gives it
// its own row of height that pushes the Stack up rather than laying over
// it, so nothing the banner renders can ever hide a control the active
// screen already placed. `headerShown: false` above is unaffected: it is a
// `Stack` option, not a height, and nothing about wrapping the `Stack` in a
// `View` changes what that option does.
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { InstallHint } from "../screens/install-hint";

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <InstallHint />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { flex: 1 },
});
