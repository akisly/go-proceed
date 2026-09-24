import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { clearPersisted, createSessionStorage, type SecretStore } from "./native/session-storage";
import { defaultAuthStorageKey } from "./native/sign-out";
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
/**
 * supabase-js 2.112.3's default key, pinned so a local sign-out can remove exactly
 * what it stored; existing sessions keep reading (a test compares the default).
 */
export const AUTH_STORAGE_KEY = defaultAuthStorageKey(SUPABASE_URL);
const AUTH_KEYS = [AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-user`, `${AUTH_STORAGE_KEY}-code-verifier`];
/** Written by the runtime with these options; cleared with the session after a reinstall. */
export const LAST_WORKSPACE = "gp.runtime.workspace";
export const LAST_WORKSPACE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const raw: SecretStore = {
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
};

/**
 * iOS keeps keychain items after the app is deleted. A new installation (no marker,
 * no vault) must not resume the earlier one's session, so it is removed before any
 * read. An update keeps the vault directory and is never reset. A failure keeps the
 * storage closed (signed out) and is retried on the next storage call.
 */
async function resetIfReinstalled(): Promise<boolean> {
  let vault;
  try { vault = requireVault(); } catch { return true; } // no native vault (Expo Go): nothing to reset against
  try {
    const { fresh } = await vault.installationCheck();
    if (fresh) {
      for (const key of AUTH_KEYS) await clearPersisted(raw, key);
      await SecureStore.deleteItemAsync(LAST_WORKSPACE, LAST_WORKSPACE_OPTIONS);
    }
    await vault.installationMark();
    return true;
  } catch { return false; }
}
let installation = resetIfReinstalled();
/** Awaited before any auth or runtime storage read, and before the vault opens its journal. */
export function installationReady(): Promise<boolean> {
  return installation.then((done) => done || (installation = resetIfReinstalled()));
}

const storage = createSessionStorage(raw, () => identityBoundary(), installationReady);
/** The persisted session, through the identity boundary; used by a local sign-out. */
export const authStorage = storage;
export const AUTH_STORAGE_KEYS: readonly string[] = AUTH_KEYS;

/** Native-only persistence; no browser or plaintext storage fallback. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    storageKey: AUTH_STORAGE_KEY,
    lock: processLock,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
