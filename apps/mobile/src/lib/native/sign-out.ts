import type { SecretStore } from "./session-storage";

/** supabase-js 2.112.3's default storage key for a project URL (pinned; a test compares it). */
export function defaultAuthStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

interface AuthClient {
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
  stopAutoRefresh(): Promise<void>;
  startAutoRefresh(): Promise<void>;
}
export interface LocalSignOut {
  auth: AuthClient;
  /** The persisted session, through the identity boundary. */
  storage: Pick<SecretStore, "getItem" | "removeItem">;
  key: string;
  keys: readonly string[];
  /** How long to wait for the library's own removal before removing the session here. */
  waitMs?: number;
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve("timeout"); });
  });
}

/**
 * Success means one thing: no session is readable through the storage adapter.
 * Every removal goes through that adapter, so the identity boundary runs first;
 * when it fails the session stays and this throws. auth-js 2.112.3 calls the
 * server even for scope "local" and, offline with an expired token, removes
 * nothing, so its {error} never decides the outcome. Offline, the server session
 * is not revoked; only this phone's copy is deleted.
 */
export async function signOutLocally({ auth, storage, key, keys, waitMs = 3_000 }: LocalSignOut): Promise<void> {
  await auth.stopAutoRefresh().catch(() => undefined);
  try {
    const first = await within(auth.signOut({ scope: "local" }), waitMs);
    const removedByLibrary = first !== "timeout" && !first.error;
    if (!removedByLibrary && await storage.getItem(key) !== null) {
      for (const each of keys) await storage.removeItem(each);
      // Nothing stored now: no request is made and SIGNED_OUT is emitted locally.
      await within(auth.signOut({ scope: "local" }), 1_000);
    }
    if (await storage.getItem(key) !== null) throw new Error("SIGN_OUT_INCOMPLETE");
  } finally {
    await auth.startAutoRefresh().catch(() => undefined);
  }
}
