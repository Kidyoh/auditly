import type { RepoDiscoveryItem, RepoScanResult, ScanResult } from './types';

export function discoveryItemToPending(repo: RepoDiscoveryItem): RepoScanResult {
  return {
    repoId: repo.id,
    repoName: repo.name,
    project: repo.project,
    defaultBranch: repo.defaultBranch,
    packages: [],
    vulnPackages: [],
    persistenceFiles: [],
    status: 'pending',
    scannedAt: '',
  };
}

/** Strip audit data — used when a new audit run begins. */
export function toPendingShell(base: RepoScanResult): RepoScanResult {
  return {
    repoId: base.repoId,
    repoName: base.repoName,
    project: base.project,
    defaultBranch: base.defaultBranch,
    packages: [],
    vulnPackages: [],
    persistenceFiles: [],
    status: 'pending',
    scannedAt: '',
    errorMessage: undefined,
  };
}

export function aggregateScanMetaFromRepos(
  repos: RepoScanResult[],
  meta: Partial<Pick<ScanResult, 'completedAt' | 'startedAt' | 'orgUrl' | 'id'>>,
): ScanResult {
  const projects = [...new Set(repos.map((r) => r.project))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

  return {
    id: meta.id ?? 'display',
    startedAt: meta.startedAt ?? '',
    completedAt: meta.completedAt ?? '',
    orgUrl: meta.orgUrl ?? '',
    projects,
    repos,
    totalRepos: repos.length,
    criticalCount: repos.filter((r) => r.status === 'critical' || r.status === 'persistence_risk')
      .length,
    packagesFlagged: repos.reduce((a, r) => a + r.vulnPackages.length, 0),
    cleanRepos: repos.filter((r) => r.status === 'clean').length,
    hasPersistenceRisk: repos.some((r) => r.persistenceFiles.length > 0),
  };
}

export function mergeInventoryWithLastScan(
  inventory: RepoScanResult[],
  lastScan: ScanResult | null,
): RepoScanResult[] {
  if (inventory.length === 0) return lastScan?.repos ?? [];
  const scanMap = new Map((lastScan?.repos ?? []).map((r) => [r.repoId, r]));
  return inventory.map((inv) => scanMap.get(inv.repoId) ?? inv);
}

export function mergeInventoryWithLiveProgress(
  inventory: RepoScanResult[],
  completedById: Record<string, RepoScanResult>,
): RepoScanResult[] {
  return inventory.map((inv) => {
    const done = completedById[inv.repoId];
    return done ?? toPendingShell(inv);
  });
}
