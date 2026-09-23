import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { createSessionStorage } from "./native/session-storage";
import { requireVault } from "./vault";

// This guard runs before Supabase replaces/removes persisted identity, including
// automatic refresh failure. Quarantine works before vault initialize as well.
let identityBoundary: () => Promise<void> = async () => { await requireVault().quarantine(); };
export function setSessionIdentityBoundary(guard: () => Promise<void>): () => void {
  identityBoundary = guard;
  return () => { if (identityBoundary === guard) identityBoundary = async () => { await requireVault().quarantine(); }; };
}

const options: SecureStore.SecureStoreOptions = {
  keychainService: "com.lightholdlabs.goproceed.auth",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const storage = createSessionStorage({
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
}, () => identityBoundary());

/** Native-only persistence; no browser or plaintext storage fallback. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    lock: processLock,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
