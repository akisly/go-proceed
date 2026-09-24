import type { VaultItem } from "../vault";
import { clientStateLabel } from "../status-labels";

/**
 * Catalog label (status.client_state.*) as the title, shared with the office
 * dashboard; field.capture.saved_local underneath once the vault has committed.
 */
export function itemTitle(item: Pick<VaultItem, "state" | "discardRequestedAt">): string {
  // A hold is not a client state: the photo keeps its state but is never sent again.
  return item.discardRequestedAt ? "Буде видалено" : clientStateLabel(item.state);
}
export function itemDetail(item: Pick<VaultItem, "state" | "discardRequestedAt">): string | null {
  if (item.discardRequestedAt) return "Сервер ще може отримати це фото. Застосунок більше не надсилатиме його й видалить, щойно сервер підтвердить, що не отримав його.";
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
export function itemProblem(item: Pick<VaultItem, "state" | "errorCode" | "discardRequestedAt">): string | null {
  if (item.state !== "failed" || item.discardRequestedAt) return null;
  return (item.errorCode && messages[item.errorCode]) || NETWORK;
}

/** Items the user still has to wait for; confirmed ones have left, held ones will not be sent. */
export function pendingCount(items: readonly Pick<VaultItem, "state" | "discardRequestedAt">[]): number {
  return items.filter((item) => item.state !== "server_confirmed" && !item.discardRequestedAt).length;
}
/** Photos the user asked to delete that wait for the server to say it did not receive them. */
export function heldCount(items: readonly Pick<VaultItem, "state" | "discardRequestedAt">[]): number {
  return items.filter((item) => item.state !== "server_confirmed" && item.discardRequestedAt).length;
}

/**
 * «All received» is a claim about the journal. It is only true when the
 * journal was actually read for the current identity; otherwise it is unknown.
 */
export type PendingSummary = { known: true; pending: number } | { known: false };
export function pendingSummary(itemsKnown: boolean, items: readonly Pick<VaultItem, "state" | "discardRequestedAt">[]): PendingSummary {
  return itemsKnown ? { known: true, pending: pendingCount(items) } : { known: false };
}

/**
 * The requirement text for the queue card, verbatim (content rules forbid trimming
 * or shortening it); left out rather than cut when it is empty or over the limit.
 */
export function requirementLabel(text: string): string | undefined {
  return text.length > 0 && text.length <= 2000 && !text.includes("\u0000") ? text : undefined;
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
  const whole = Math.floor(bytes / (1024 * 1024));
  return whole >= 1 ? `${whole} МБ` : `${Math.max(1, Math.floor(bytes / 1024))} КБ`;
}
