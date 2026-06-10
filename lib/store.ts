import type { ScanResult } from './types';

interface ScanStore {
  isScanning: boolean;
  lastResult: ScanResult | null;
}

const globalStore = globalThis as typeof globalThis & { __auditly_store?: ScanStore };

if (!globalStore.__auditly_store) {
  globalStore.__auditly_store = { isScanning: false, lastResult: null };
}

export const store = globalStore.__auditly_store;
