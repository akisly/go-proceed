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
};
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
  purgeExpired(): Promise<void>;
}
