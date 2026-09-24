export type VaultContext = { subjectId: string; workspaceId: string };
export type VaultState = 'not_sent' | 'sending' | 'awaiting_receipt' | 'failed' | 'quarantined' | 'server_confirmed';
export type VaultItem = VaultContext & {
  id: string;
  assignmentId: string;
  occurrenceId: string;
  originMethod: 'native_camera' | 'photo_picker';
  mimeType: string;
  sha256: string;
  byteSize: number;
  claimedCaptureTime: string;
  sourceAppVersion: string;
  createdAt: string;
  createIdempotencyKey: string;
  finalizeIdempotencyKey: string;
  state: VaultState;
  intentId?: string;
  evidenceId?: string;
  errorCode?: string;
  quarantineWarnedAt?: string;
  /** Requirement text captured at import, verbatim; shown offline. Older items have none. */
  requirementLabel?: string;
  /** The user asked to delete it while the server could still receive it: never sent again. */
  discardRequestedAt?: string;
};
export type ImportPhoto = {
  /** Only a file:// URI under the application's camera/picker cache is accepted. */
  uri: string;
  assignmentId: string;
  occurrenceId: string;
  originMethod: VaultItem['originMethod'];
  mimeType: string;
  maxBytes: number;
  claimedCaptureTime: string;
  sourceAppVersion: string;
  /** The identity the caller authorized; the vault refuses the import if its open identity differs. */
  expectedSubjectId: string;
  expectedWorkspaceId: string;
  /** Verbatim requirement text, at most 2000 UTF-16 units; omit rather than shorten. */
  requirementLabel?: string;
};
/** Which parts of a wipe are done; photos cannot be opened once keys or ciphertext are gone. */
export type WipeResult = { keysDeleted: boolean; ciphertextDeleted: boolean; directoryDeleted: boolean };
export type AvailableReceipt = { status: 'available'; evidenceId: string; sha256: string; byteSize: number };
export interface VaultAPI {
  initialize(options: { storageOrigins: string[] }): Promise<void>;
  authenticate(context: VaultContext): Promise<void>;
  importPhoto(input: ImportPhoto): Promise<VaultItem>;
  list(): Promise<VaultItem[]>;
  setUploadIntent(id: string, intent: { intentId: string; evidenceId?: string }): Promise<void>;
  markAwaitingReceipt(id: string): Promise<void>;
  markFailed(id: string, errorCode: string): Promise<void>;
  upload(id: string, grant: { url: string; headers: Record<string, string> }): Promise<{ status: number }>;
  cancelUpload(): Promise<void>;
  confirmReceipt(id: string, receipt: AvailableReceipt): Promise<void>;
  /** Cancels the active transfer before waiting for the journal. */
  quarantine(): Promise<void>;
  restore(): Promise<void>;
  warnQuarantine(): Promise<void>;
  discard(id: string, confirmation: { confirmed: true }): Promise<void>;
  /** Holds an item the server may still receive: it is never uploaded or given a new intent. */
  requestDiscard(id: string, confirmation: { confirmed: true }): Promise<VaultItem>;
  /** Deletes every identity's items without opening the journal. */
  wipe(confirmation: { confirmed: true }): Promise<WipeResult>;
  /** True when neither the installation marker nor a vault exists: a new install. */
  installationCheck(): Promise<{ fresh: boolean }>;
  installationMark(): Promise<void>;
  /** Lock-free: stops any transfer and closes the native identity, without opening the journal. */
  closeIdentity(): void;
  purgeExpired(): Promise<void>;
}
