'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { RepoTable } from '@/components/dashboard/RepoTable';
import { RunScanButton } from '@/components/dashboard/RunScanButton';
import { PersistenceBanner } from '@/components/layout/PersistenceBanner';
import { Button } from '@/components/ui/button';
import { useScanResults } from '@/hooks/useScan';
import { useRepos } from '@/hooks/useRepos';
import {
  aggregateScanMetaFromRepos,
  discoveryItemToPending,
  mergeInventoryWithLastScan,
  mergeInventoryWithLiveProgress,
} from '@/lib/repo-inventory';
import { RefreshCw, Activity, Sparkles } from 'lucide-react';
import type { ScanResult, RepoScanResult } from '@/lib/types';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: storedData } = useScanResults();
  const {
    data: reposPayload,
    isLoading: reposLoading,
    isError: reposError,
    error: reposQueryError,
    refetch: refetchRepos,
    isFetching: reposFetching,
  } = useRepos();

  const [liveResult, setLiveResult] = useState<ScanResult | null>(null);
  const [completedThisRun, setCompletedThisRun] = useState<Record<string, RepoScanResult>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanningRepo, setScanningRepo] = useState('');

  const inventory = useMemo(
    () => (reposPayload?.repos ?? []).map(discoveryItemToPending),
    [reposPayload],
  );

  const lastScan = liveResult ?? storedData?.result ?? null;

  const mergedRepos = useMemo(() => {
    if (inventory.length === 0) return lastScan?.repos ?? [];

    if (isScanning) {
      const hasLiveProgress = Object.keys(completedThisRun).length > 0;
      if (!hasLiveProgress) return inventory.map((i) => ({ ...i }));
      return mergeInventoryWithLiveProgress(inventory, completedThisRun);
    }

    return mergeInventoryWithLastScan(inventory, lastScan);
  }, [inventory, lastScan, isScanning, completedThisRun]);

  const displayResult: ScanResult | null = mergedRepos.length
    ? aggregateScanMetaFromRepos(mergedRepos, {
        id: lastScan?.id,
        completedAt: lastScan?.completedAt ?? (isScanning ? '' : undefined),
        startedAt: lastScan?.startedAt,
        orgUrl: lastScan?.orgUrl,
      })
    : null;

  const persistencePaths =
    displayResult?.repos
      .flatMap((r) => r.persistenceFiles.map((f) => f.path))
      .filter((v, i, a) => a.indexOf(v) === i) ?? [];

  const handleScanStart = useCallback(() => {
    setLiveResult(null);
    setCompletedThisRun({});
  }, []);

  const handleScanAbort = useCallback(() => {
    setCompletedThisRun({});
  }, []);

  const handleScanUpdate = useCallback((repos: RepoScanResult[]) => {
    setCompletedThisRun(() => {
      const next: Record<string, RepoScanResult> = {};
      for (const r of repos) next[r.repoId] = r;
      return next;
    });
  }, []);

  const handleScanComplete = useCallback(
    (res: ScanResult) => {
      setLiveResult(res);
      setCompletedThisRun({});
      queryClient.invalidateQueries({ queryKey: ['scan-results'] });
    },
    [queryClient],
  );

  const inventoryErrorMsg = reposQueryError instanceof Error ? reposQueryError.message : null;
  const auditReady = inventory.length > 0;

  const lastAuditLabel = displayResult?.completedAt
    ? new Date(displayResult.completedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const inventoryStatusLabel = (() => {
    if (reposLoading) return 'Discovering repositories…';
    if (reposError) return 'Inventory unavailable';
    if (inventory.length > 0) return `${inventory.length} repositories discovered`;
    return 'No repositories yet';
  })();

  return (
    <>
      {displayResult?.hasPersistenceRisk ? (
        <PersistenceBanner paths={persistencePaths} />
      ) : null}

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-10 md:px-8 md:py-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-hairline bg-card shadow-elevated">
          <div
            aria-hidden
            className="bg-grid-soft pointer-events-none absolute inset-0 opacity-60 mask-[radial-gradient(circle_at_top,black,transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl"
          />

          <div className="relative grid gap-8 px-6 py-8 md:grid-cols-[1.4fr_1fr] md:px-10 md:py-10">
            <div className="flex flex-col gap-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                <span className="uppercase tracking-[0.14em]">Dependency security</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-heading text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-[2.25rem]">
                  Audit every Azure DevOps repository for vulnerable packages.
                </h1>
                <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                  Inventory is fetched live from Azure DevOps. Run an audit to parse manifests across
                  every project and cross-reference{' '}
                  <a
                    href="https://osv.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    OSV.dev
                  </a>{' '}
                  for known CVEs and persistence indicators.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reposLoading || reposFetching}
                  onClick={() => void refetchRepos()}
                  className="gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${reposFetching ? 'animate-spin' : ''}`} />
                  Refresh inventory
                </Button>

                <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-subtle px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${
                      reposError
                        ? 'bg-red-500'
                        : reposLoading || reposFetching
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-emerald-500'
                    }`}
                  />
                  {inventoryStatusLabel}
                </span>

                {reposPayload?.message ? (
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    {reposPayload.message}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="md:justify-self-end md:self-center">
              <div className="surface-card-flat flex flex-col gap-4 p-5 md:min-w-[18rem]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Activity className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Audit
                    </span>
                  </div>
                  {lastAuditLabel ? (
                    <span className="text-[11px] text-muted-foreground">
                      Last run · {lastAuditLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">No prior audits</span>
                  )}
                </div>
                <RunScanButton
                  auditDisabledReason={
                    reposLoading
                      ? 'Still loading repositories…'
                      : auditReady
                        ? null
                        : 'Load repositories before auditing'
                  }
                  onScanAbort={handleScanAbort}
                  onScanUpdate={handleScanUpdate}
                  onScanComplete={handleScanComplete}
                  onScanStart={handleScanStart}
                  isScanning={isScanning}
                  setIsScanning={setIsScanning}
                  setScanningRepo={setScanningRepo}
                />
              </div>
            </div>
          </div>
        </section>

        <SummaryCards
          result={displayResult}
          isScanning={isScanning}
          inventoryLoading={reposLoading && inventory.length === 0}
        />

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                Repositories
              </h2>
              <p className="text-xs text-muted-foreground">
                Every Git repository discovered across your Azure DevOps organization.
              </p>
            </div>
            {displayResult?.totalRepos ? (
              <span className="rounded-full border border-hairline bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {displayResult.totalRepos} total
              </span>
            ) : null}
          </div>

          <RepoTable
            result={displayResult}
            isScanning={isScanning}
            scanningRepo={scanningRepo}
            inventoryLoading={reposLoading && mergedRepos.length === 0}
            inventoryError={reposError ? inventoryErrorMsg : null}
            inventoryReady={inventory.length > 0}
          />
        </section>
      </div>
    </>
  );
}
