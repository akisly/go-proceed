// Routes only. Screen bodies live in src/screens — this directory is the route
// table and nothing else, so a file added here is a URL, not a component.
//
// `headerShown: false` is not styling. B0's deliverable is exactly what
// src/screens/token-proof.tsx renders, and the old entry (App.tsx) rendered it
// with no navigator chrome above it. A default Stack header would put a bar the
// screen never had on top of it, which would make the router migration change
// the deliverable. B1 adds real screens to this same Stack and decides its own
// header per route.
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
