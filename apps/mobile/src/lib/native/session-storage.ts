export interface SecretStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const CHUNK_CHARACTERS = 384; // At most 1536 UTF-8 bytes, below historical iOS limits.
const MAX_CHUNKS = 256;
type Slot = 0 | 1;

function subject(value: string | null): string | null {
  try {
    const parsed = JSON.parse(value ?? "null");
    return typeof parsed?.user?.id === "string" ? parsed.user.id : null;
  } catch { return null; }
}

const base = (key: string) => `gp.auth.${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
async function storedCount(store: SecretStore, prefix: string, slot: Slot): Promise<number> {
  const count = Number(await store.getItem(`${prefix}.${slot}.count`));
  return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : 0;
}
async function clearStoredSlot(store: SecretStore, prefix: string, slot: Slot): Promise<void> {
  const count = await storedCount(store, prefix, slot);
  for (let i = 0; i < count; i += 1) await store.removeItem(`${prefix}.${slot}.${i}`);
  await store.removeItem(`${prefix}.${slot}.count`);
}
/**
 * Removes a persisted value without the identity boundary. Only for a new
 * installation, whose vault holds nothing to quarantine yet.
 */
export async function clearPersisted(store: SecretStore, key: string): Promise<void> {
  const prefix = base(key);
  await store.removeItem(`${prefix}.manifest`);
  await clearStoredSlot(store, prefix, 0);
  await clearStoredSlot(store, prefix, 1);
}

/**
 * Two protected generations avoid partially written sessions. All values,
 * including chunk counts/pointers, live in SecureStore, never AsyncStorage.
 * A failed write leaves the previous generation readable; orphaned inactive
 * chunks are recoverable from that slot's count on the next write/removal.
 */
export function createSessionStorage(
  store: SecretStore,
  beforeIdentityChange: () => Promise<void>,
  /** Resolves true once a reinstall reset is done; false keeps storage closed (reads null). */
  ready: () => Promise<boolean> = async () => true,
): SecretStore {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => undefined);
    return result;
  };
  const slotCount = (prefix: string, slot: Slot) => storedCount(store, prefix, slot);
  const activeSlot = async (prefix: string): Promise<Slot | null> => {
    const value = await store.getItem(`${prefix}.manifest`);
    return value === "0" ? 0 : value === "1" ? 1 : null;
  };
  const read = async (key: string): Promise<string | null> => {
    const prefix = base(key), slot = await activeSlot(prefix);
    if (slot === null) return null;
    const count = await slotCount(prefix, slot);
    if (!count) return null;
    let value = "";
    for (let i = 0; i < count; i += 1) {
      const chunk = await store.getItem(`${prefix}.${slot}.${i}`);
      if (chunk === null) return null;
      value += chunk;
    }
    return value;
  };
  const clearSlot = (prefix: string, slot: Slot) => clearStoredSlot(store, prefix, slot);
  // An earlier installation's session is never read or overwritten before the reset.
  const open = async () => { if (!(await ready())) throw new Error("INSTALLATION_RESET_FAILED"); };
  return {
    getItem: (key) => serial(async () => (await ready()) ? read(key) : null),
    setItem: (key, value) => serial(async () => {
      await open();
      const count = Math.max(1, Math.ceil(value.length / CHUNK_CHARACTERS));
      if (count > MAX_CHUNKS) throw new Error("SESSION_STORAGE_LIMIT");
      if (subject(await read(key)) !== subject(value)) await beforeIdentityChange();
      const prefix = base(key), oldSlot = await activeSlot(prefix), slot = oldSlot === 0 ? 1 : 0;
      await clearSlot(prefix, slot);
      await store.setItem(`${prefix}.${slot}.count`, String(count));
      for (let i = 0; i < count; i += 1) {
        await store.setItem(`${prefix}.${slot}.${i}`, value.slice(i * CHUNK_CHARACTERS, (i + 1) * CHUNK_CHARACTERS));
      }
      await store.setItem(`${prefix}.manifest`, String(slot));
      // The new session is committed. Retrying cleanup is safe on the next write.
      if (oldSlot !== null) await clearSlot(prefix, oldSlot).catch(() => undefined);
    }),
    removeItem: (key) => serial(async () => {
      await open();
      await beforeIdentityChange();
      const prefix = base(key);
      await store.removeItem(`${prefix}.manifest`);
      await clearSlot(prefix, 0);
      await clearSlot(prefix, 1);
    }),
  };
}
