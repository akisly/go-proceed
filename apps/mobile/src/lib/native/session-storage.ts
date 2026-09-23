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

/**
 * Two protected generations avoid partially written sessions. All values,
 * including chunk counts/pointers, live in SecureStore, never AsyncStorage.
 * A failed write leaves the previous generation readable; orphaned inactive
 * chunks are recoverable from that slot's count on the next write/removal.
 */
export function createSessionStorage(store: SecretStore, beforeIdentityChange: () => Promise<void>): SecretStore {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => undefined);
    return result;
  };
  const base = (key: string) => `gp.auth.${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const slotCount = async (prefix: string, slot: Slot): Promise<number> => {
    const count = Number(await store.getItem(`${prefix}.${slot}.count`));
    return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : 0;
  };
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
  const clearSlot = async (prefix: string, slot: Slot): Promise<void> => {
    const count = await slotCount(prefix, slot);
    for (let i = 0; i < count; i += 1) await store.removeItem(`${prefix}.${slot}.${i}`);
    await store.removeItem(`${prefix}.${slot}.count`);
  };
  return {
    getItem: (key) => serial(() => read(key)),
    setItem: (key, value) => serial(async () => {
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
      await beforeIdentityChange();
      const prefix = base(key);
      await store.removeItem(`${prefix}.manifest`);
      await clearSlot(prefix, 0);
      await clearSlot(prefix, 1);
    }),
  };
}
