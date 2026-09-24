import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import Constants from "expo-constants";
import { useNetworkState } from "expo-network";
import { Directory, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import type { Session } from "@supabase/supabase-js";
import { meContextResponse } from "@goproceed/contracts";
import { apiGet, apiPost, readProblem, requireSession } from "../api";
import { SUPABASE_URL } from "../env";
import { AUTH_STORAGE_KEY, AUTH_STORAGE_KEYS, LAST_WORKSPACE, LAST_WORKSPACE_OPTIONS, authStorage, installationReady, setSessionIdentityBoundary, supabase } from "../supabase";
import { requireVault, type ImportPhoto, type VaultAPI, type VaultItem, type WipeResult } from "../vault";
import { createAuthorize } from "./authorize";
import { pendingCount } from "./item-labels";
import { NativeQueue, QueueRequestError, type QueueAPI } from "./queue";
import { signOutLocally } from "./sign-out";

/**
 * booting: session or vault not known yet. ready: the vault can import and send.
 * unavailable: this build has no native vault (Expo Go, web); capture stays off.
 * error: the vault exists but could not open its journal or keystore.
 */
export type RuntimeStatus = "booting" | "ready" | "unavailable" | "error";
/** `workspaceId` is the workspace the capture screen authorized; the import refuses any other. */
export type CaptureImport = Omit<ImportPhoto, "sourceAppVersion" | "expectedSubjectId" | "expectedWorkspaceId"> & { workspaceId: string };

export interface NativeRuntime {
  status: RuntimeStatus;
  session: Session | null;
  /** The workspace whose local queue is open; null until a screen confirms access. */
  workspaceId: string | null;
  items: VaultItem[];
  /** True only when `items` is a real read of the journal for the current identity. */
  itemsKnown: boolean;
  /** The server refused this identity mid-send; items are quarantined until access returns. */
  accessChanged: boolean;
  /**
   * This session left another workspace with unsent items. The vault lists one
   * workspace at a time, so those items wait until that workspace is opened again.
   * In memory only: after a restart it is unknown, which screens must not read as zero.
   */
  pendingElsewhere: boolean;
  /**
   * Other workspaces' journals cannot be read from here. True unless this subject
   * has exactly one active membership, so «nothing to lose» is never assumed.
   */
  othersUnknown: boolean;
  activateWorkspace(workspaceId: string): Promise<void>;
  importPhoto(input: CaptureImport): Promise<VaultItem>;
  /** Marks a capture in progress (shutter to commit) so no sweep removes its plaintext. */
  holdCapture(): () => void;
  send(): Promise<void>;
  discard(id: string): Promise<void>;
  /**
   * Removes the session from this phone, with or without a network. Unsent photos are
   * locked first (or, when the vault cannot open, stay locked where they are).
   */
  signOut(): Promise<void>;
  /**
   * Deletes every account's unsent photos on this phone without opening the journal,
   * then signs out if signed in. Throws WIPE_FAILED when the photos could still be opened.
   */
  wipe(): Promise<WipeResult>;
  /** Held photos the server received anyway (in memory only). */
  receivedAnyway: readonly string[];
  dismissReceivedAnyway(): void;
}

const RuntimeContext = createContext<NativeRuntime | null>(null);
const secure = LAST_WORKSPACE_OPTIONS;

const appVersion = Constants.expoConfig?.version ?? "0.0.0";

async function json(response: Response): Promise<unknown> {
  if (response.ok) return response.json();
  const problem = await readProblem(response);
  throw new QueueRequestError(response.status, problem.code ?? `HTTP_${response.status}`);
}
const queueApi: QueueAPI = {
  get: async (path, signal) => json(await apiGet(path, signal)),
  post: async (path, body, key, signal) => json(await apiPost(path, body, key, signal)),
};

const authorize = createAuthorize({
  get: queueApi.get,
  currentSubject: async () => (await requireSession())?.user.id ?? null,
});
const forgetWorkspace = () => SecureStore.deleteItemAsync(LAST_WORKSPACE, secure).catch(() => undefined);

/** Plaintext camera/picker leftovers from an interrupted import; ciphertext lives elsewhere. */
function sweepCaptureCache(): void {
  for (const name of ["Camera", "ImagePicker"]) {
    try {
      const directory = new Directory(Paths.cache, name);
      if (directory.exists) directory.delete();
    } catch { /* A locked or missing cache is retried on the next launch. */ }
  }
}

export function NativeRuntimeProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionKnown, setSessionKnown] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<RuntimeStatus>("booting");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [itemsKnown, setItemsKnown] = useState(false);
  const [accessChanged, setAccessChanged] = useState(false);
  const network = useNetworkState();
  const vaultRef = useRef<VaultAPI | null>(null);
  const queueRef = useRef<NativeQueue | null>(null);
  const subjectRef = useRef<string | null>(null);
  const importing = useRef(0);
  const [elsewhere, setElsewhere] = useState<ReadonlySet<string>>(new Set());
  const [memberships, setMemberships] = useState<number | null>(null);
  const known = useRef<{ workspaceId: string | null; pending: number | null }>({ workspaceId: null, pending: null });
  const vaultStatusRef = useRef<RuntimeStatus>("booting");
  // Set by a verified wipe: nothing openable is left, so the boundary has nothing to lock.
  const wiped = useRef(false);
  const signingOut = useRef(false);
  const [receivedAnyway, setReceivedAnyway] = useState<readonly string[]>([]);

  const refresh = useCallback(async () => {
    const vault = vaultRef.current, queue = queueRef.current;
    if (!vault || !queue?.identity) { setItems([]); setItemsKnown(false); known.current = { workspaceId: null, pending: null }; return; }
    const workspace = queue.identity.workspaceId;
    try {
      const list = await vault.list();
      setItems(list); setItemsKnown(true);
      known.current = { workspaceId: workspace, pending: pendingCount(list) };
      if (pendingCount(list) === 0) setElsewhere((set) => set.has(workspace) ? new Set([...set].filter((id) => id !== workspace)) : set);
    } catch { setItems([]); setItemsKnown(false); known.current = { workspaceId: null, pending: null }; }
  }, []);

  /** Runs the queue; a 401/403 inside it quarantines and drops the identity. */
  const runQueue = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue?.identity || signingOut.current) return;
    const subject = subjectRef.current;
    await queue.run().catch(() => undefined);
    if (queue.revoked && subject && subjectRef.current === subject) {
      // Revoked: the next launch must not reopen these items before a server read.
      setAccessChanged(true); setWorkspaceId(null); await forgetWorkspace();
    }
    await refresh();
  }, [refresh]);

  // Vault first: the identity boundary must exist before Supabase can touch a session.
  useEffect(() => {
    let current = true, release = () => {};
    let vault: VaultAPI | null = null;
    try { vault = requireVault(); } catch { vault = null; }
    if (!vault) {
      // No native vault means no local items: nothing to quarantine on identity change.
      release = setSessionIdentityBoundary(async () => {});
      setVaultStatus("unavailable");
      return () => { current = false; release(); };
    }
    const queue = new NativeQueue({ vault, api: queueApi, authorize, changed: () => refresh(),
      receivedDespiteDiscard: (item) => setReceivedAnyway((ids) => ids.includes(item.id) ? ids : [...ids, item.id]) });
    vaultRef.current = vault;
    queueRef.current = queue;
    release = setSessionIdentityBoundary(async () => {
      setWorkspaceId(null);
      // A vault that never opened has no identity open and nothing readable: its photos
      // stay locked where they are (owner, 2026-09-24). After a verified wipe nothing is left.
      if (vaultStatusRef.current === "error" || wiped.current) queue.stop();
      else await queue.quarantine();
      await forgetWorkspace();
      if (importing.current === 0) sweepCaptureCache();
    });
    sweepCaptureCache();
    // The installation check must see the vault directory before initialize creates it.
    void installationReady()
      .then(() => vault.initialize({ storageOrigins: [new URL(SUPABASE_URL).origin] }))
      .then(() => { if (current) { vaultStatusRef.current = "ready"; setVaultStatus("ready"); } })
      .catch(() => { if (current) { vaultStatusRef.current = "error"; setVaultStatus("error"); } });
    return () => { current = false; release(); void queue.pause(); };
  }, [refresh]);

  useEffect(() => {
    let current = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!current) return;
      setSession(data.session); setSessionKnown(true);
    }).catch(() => { if (current) setSessionKnown(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setSessionKnown(true);
    });
    return () => { current = false; data.subscription.unsubscribe(); };
  }, []);

  const subject = session?.user.id ?? null;
  const activateWorkspace = useCallback(async (next: string) => {
    // The owner is the bearer's subject, not React state that lags the boundary.
    const owner = (await requireSession())?.user.id ?? null;
    if (!owner || owner !== subjectRef.current || signingOut.current) throw new Error("SESSION_CHANGED");
    const queue = queueRef.current;
    if (queue && vaultStatus === "ready") {
      const left = known.current;
      if (left.workspaceId && left.workspaceId !== next && left.pending !== 0) {
        setElsewhere((set) => new Set([...set, left.workspaceId!]));
      }
      await queue.activate({ subjectId: owner, workspaceId: next });
      const identity = queue.identity;
      if (identity?.subjectId !== owner || identity.workspaceId !== next) throw new Error("SUPERSEDED");
      await SecureStore.setItemAsync(LAST_WORKSPACE, `${owner}:${next}`, secure).catch(() => undefined);
      setAccessChanged(false);
      void runQueue();
    }
    if (subjectRef.current === owner) setWorkspaceId(next);
  }, [vaultStatus, runQueue]);

  // Reopens the last workspace's queue for the same subject. Every send still
  // re-reads server authorization, and a refusal quarantines the items.
  useEffect(() => {
    subjectRef.current = subject;
    setWorkspaceId(null); setAccessChanged(false); setElsewhere(new Set()); setMemberships(null);
    if (!subject || vaultStatus !== "ready") { setItems([]); setItemsKnown(false); return; }
    let current = true;
    void installationReady().then(() => SecureStore.getItemAsync(LAST_WORKSPACE, secure)).then(async (value) => {
      const [owner, last] = value?.split(":") ?? [];
      if (!current || owner !== subject || !last) return;
      await activateWorkspace(last);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [subject, vaultStatus, activateWorkspace]);

  // One membership means the open workspace is the only journal this subject can have.
  useEffect(() => {
    if (!subject) return;
    let current = true;
    void apiGet("/v1/me/context").then(async (response) => {
      if (!response.ok) return;
      const context = meContextResponse.safeParse(await response.json());
      if (current && context.success && context.data.userId === subject) {
        setMemberships(context.data.memberships.filter((m) => m.status === "active").length);
      }
    }).catch(() => undefined);
    return () => { current = false; };
  }, [subject]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      const queue = queueRef.current;
      if (!queue) return;
      if (state === "active") { queue.resume(); void runQueue(); }
      // "inactive" is also a permission prompt or Control Center; only leaving the app stops sending.
      else if (state === "background") {
        void queue.pause().then(refresh).catch(() => undefined);
        // Plaintext camera/picker copies do not outlive the foreground unless an import owns them.
        if (importing.current === 0) sweepCaptureCache();
      }
    });
    return () => listener.remove();
  }, [refresh, runQueue]);

  // Reconnecting in the foreground sends what waited offline; no background claim.
  const connected = network.isConnected === true && network.isInternetReachable !== false;
  useEffect(() => { if (connected) void runQueue(); }, [connected, runQueue]);

  const importPhoto = useCallback(async ({ workspaceId: expected, ...input }: CaptureImport) => {
    const vault = vaultRef.current, queue = queueRef.current;
    if (!vault || !queue?.identity || vaultStatus !== "ready" || signingOut.current) throw new Error("VAULT_NOT_READY");
    // The vault stamps its open identity; refuse unless that is what the screen authorized.
    if (queue.identity.workspaceId !== expected || queue.identity.subjectId !== subjectRef.current) {
      throw new Error("WORKSPACE_MISMATCH");
    }
    importing.current += 1;
    try {
      return await vault.importPhoto({ ...input, sourceAppVersion: appVersion,
        expectedSubjectId: queue.identity.subjectId, expectedWorkspaceId: expected });
    } finally {
      importing.current -= 1;
      await refresh();
      void runQueue();
    }
  }, [vaultStatus, refresh, runQueue]);

  const holdCapture = useCallback(() => {
    importing.current += 1;
    let released = false;
    return () => { if (!released) { released = true; importing.current -= 1; } };
  }, []);

  const send = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue) return;
    queue.resume();
    await runQueue();
  }, [runQueue]);

  const discard = useCallback(async (id: string) => {
    const queue = queueRef.current;
    if (!queue?.identity) throw new Error("VAULT_NOT_READY");
    try { await queue.discard(id); } finally { await refresh(); void runQueue(); }
  }, [refresh, runQueue]);

  const clearSignedOut = useCallback(() => {
    setSession(null); setItems([]); setItemsKnown(false); setWorkspaceId(null);
    setElsewhere(new Set()); setMemberships(null); setAccessChanged(false); setReceivedAnyway([]);
  }, []);

  /** Works offline; see signOutLocally. New work is refused while it runs. */
  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      await signOutLocally({ auth: supabase.auth, storage: authStorage, key: AUTH_STORAGE_KEY, keys: AUTH_STORAGE_KEYS });
      clearSignedOut();
    } finally { signingOut.current = false; }
  }, [clearSignedOut]);

  const wipe = useCallback(async () => {
    const vault = vaultRef.current, queue = queueRef.current;
    if (!vault || !queue) throw new Error("VAULT_NOT_READY");
    queue.stop();
    const result = await vault.wipe({ confirmed: true });
    // Photos cannot be opened without their keys, or without their ciphertext.
    if (!result.keysDeleted && !result.ciphertextDeleted) throw new Error("WIPE_FAILED");
    wiped.current = true;
    setItems([]); setItemsKnown(false);
    if (await authStorage.getItem(AUTH_STORAGE_KEY) !== null) await signOut();
    // A fresh vault, in this process: the next sign-in can reach ready without a restart.
    try {
      await vault.initialize({ storageOrigins: [new URL(SUPABASE_URL).origin] });
      wiped.current = false; vaultStatusRef.current = "ready"; setVaultStatus("ready");
    } catch { vaultStatusRef.current = "error"; setVaultStatus("error"); }
    return result;
  }, [signOut]);
  const dismissReceivedAnyway = useCallback(() => setReceivedAnyway([]), []);

  const status: RuntimeStatus = !sessionKnown ? "booting" : vaultStatus;
  const pendingElsewhere = elsewhere.size > 0;
  const othersUnknown = memberships !== 1;
  const value = useMemo<NativeRuntime>(() => ({
    status, session, workspaceId, items, itemsKnown, accessChanged, pendingElsewhere, othersUnknown, activateWorkspace, importPhoto, holdCapture, send, discard, signOut,
    wipe, receivedAnyway, dismissReceivedAnyway,
  }), [status, session, workspaceId, items, itemsKnown, accessChanged, pendingElsewhere, othersUnknown, activateWorkspace, importPhoto, holdCapture, send, discard, signOut,
    wipe, receivedAnyway, dismissReceivedAnyway]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useNativeRuntime(): NativeRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("NativeRuntimeProvider is missing");
  return runtime;
}
