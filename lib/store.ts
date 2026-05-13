import type { ScanResult } from './types';

interface ScanStore {
  isScanning: boolean;
  lastResult: ScanResult | null;
}

const globalStore = globalThis as typeof globalThis & { __repo_audit_store?: ScanStore };

if (!globalStore.__repo_audit_store) {
  globalStore.__repo_audit_store = { isScanning: false, lastResult: null };
}

export const store = globalStore.__repo_audit_store;
