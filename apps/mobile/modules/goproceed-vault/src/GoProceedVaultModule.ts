import { requireOptionalNativeModule } from 'expo';
import type { VaultAPI } from './GoProceedVault.types';

// An Expo Go or unsupported build must never silently fall back to plaintext.
type NativeVault = { call(operation: string, payload: string): Promise<string>; cancel(quarantine: boolean): void };
const native = requireOptionalNativeModule<NativeVault>('GoProceedVault');
const call = async <T>(operation: string, payload: unknown = {}): Promise<T> => {
  if (!native) throw new Error('VAULT_NATIVE_BUILD_REQUIRED');
  return JSON.parse(await native.call(operation, JSON.stringify(payload))) as T;
};
const api: VaultAPI = {
  initialize: (payload) => call('initialize', payload),
  authenticate: (payload) => call('authenticate', payload),
  importPhoto: (payload) => call('importPhoto', payload),
  list: () => call('list'),
  setUploadIntent: (id, intent) => call('setUploadIntent', { id, ...intent }),
  markAwaitingReceipt: (id) => call('markAwaitingReceipt', { id }),
  markFailed: (id, errorCode) => call('markFailed', { id, errorCode }),
  upload: (id, grant) => call('upload', { id, ...grant }),
  cancelUpload: async () => { native?.cancel(false); },
  confirmReceipt: (id, receipt) => call('confirmReceipt', { id, ...receipt }),
  quarantine: async () => {
    if (!native) throw new Error('VAULT_NATIVE_BUILD_REQUIRED');
    native.cancel(true);
    await call('quarantine');
  },
  restore: () => call('restore'),
  warnQuarantine: () => call('warnQuarantine'),
  discard: (id, confirmation) => call('discard', { id, ...confirmation }),
  purgeExpired: () => call('purgeExpired'),
};
export function requireVault(): VaultAPI {
  if (!native) throw new Error('VAULT_NATIVE_BUILD_REQUIRED');
  return api;
}
