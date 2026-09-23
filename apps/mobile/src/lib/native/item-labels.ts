import type { VaultItem } from "../vault";
import { clientStateLabel } from "../status-labels";

/**
 * Catalog label (status.client_state.*) as the title, shared with the office
 * dashboard; field.capture.saved_local underneath once the vault has committed.
 */
export function itemTitle(item: Pick<VaultItem, "state">): string {
  return clientStateLabel(item.state);
}
export function itemDetail(item: Pick<VaultItem, "state">): string | null {
  return item.state === "not_sent" ? "Збережено на пристрої" : null;
}

const NETWORK = "Не вдалося надіслати. Перевірте з’єднання та спробуйте ще раз.";
const messages: Record<string, string> = {
  RECEIPT_MISMATCH: "Сервер не підтвердив цей файл. Спробуйте надіслати ще раз.",
  INTENT_MISMATCH: "Сервер відповів неочікувано. Спробуйте надіслати ще раз.",
  VAULT_CIPHERTEXT_CORRUPT: "Файл на пристрої пошкоджено, його не можна надіслати. Видаліть його й зробіть фото знову.",
  VAULT_KEY_UNAVAILABLE: "Ключ до файлу на пристрої недоступний. Видаліть його й зробіть фото знову.",
  UPLOAD_EXPIRED_OR_REJECTED: "Сервер відхилив файл. Видаліть його й зробіть фото знову.",
};

/** Why an item is not sent, without paths, keys or server internals. */
export function itemProblem(item: Pick<VaultItem, "state" | "errorCode">): string | null {
  if (item.state !== "failed") return null;
  return (item.errorCode && messages[item.errorCode]) || NETWORK;
}

/** Items the user still has to wait for; confirmed ones have already left the device. */
export function pendingCount(items: readonly Pick<VaultItem, "state">[]): number {
  return items.filter((item) => item.state !== "server_confirmed").length;
}

/**
 * «All received» is a claim about the journal. It is only true when the
 * journal was actually read for the current identity; otherwise it is unknown.
 */
export type PendingSummary = { known: true; pending: number } | { known: false };
export function pendingSummary(itemsKnown: boolean, items: readonly Pick<VaultItem, "state">[]): PendingSummary {
  return itemsKnown ? { known: true, pending: pendingCount(items) } : { known: false };
}

/** Pending count that switching to `target` would park (the vault sends one workspace at a time). */
export function parkedBySwitch(open: string | null, target: string, summary: PendingSummary): number {
  return open && open !== target && summary.known ? summary.pending : 0;
}

const mediaNames: Record<string, string> = {
  "image/jpeg": "JPEG", "image/png": "PNG", "image/heic": "HEIC", "image/heif": "HEIF", "image/webp": "WebP",
};
export function mediaList(mimeTypes: readonly string[]): string {
  return mimeTypes.map((type) => mediaNames[type] ?? type).join(", ");
}
/** Whole megabytes, rounded down so the stated limit is never above the real one. */
export function megabytes(bytes: number): string {
  return `${Math.max(1, Math.floor(bytes / (1024 * 1024)))} МБ`;
}
