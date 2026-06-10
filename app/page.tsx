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
import { RefreshCw } from 'lucide-react';
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
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());

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
        githubLogin: lastScan?.githubLogin,
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

  return (
    <>
      {displayResult?.hasPersistenceRisk ? (
        <PersistenceBanner paths={persistencePaths} />
      ) : null}

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 md:px-8 md:py-10">

        {/* Page header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Repositories
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {/* inventory status */}
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                reposError ? 'bg-red-500' :
                reposLoading || reposFetching ? 'bg-amber-500 animate-pulse' :
                inventory.length > 0 ? 'bg-emerald-500' : 'bg-zinc-500'
              }`} />
              <span className="text-sm text-muted-foreground">
                {reposLoading
                  ? 'Discovering repositories…'
                  : reposError
                    ? 'Could not load inventory'
                    : inventory.length > 0
                      ? `${inventory.length} repos found`
                      : 'No repositories yet'}
              </span>
              {lastAuditLabel && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-sm text-muted-foreground">
                    Last scanned {lastAuditLabel}
                  </span>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={reposLoading || reposFetching}
                onClick={() => void refetchRepos()}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-3 w-3 ${reposFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Audit controls */}
          <div className="w-full sm:w-64">
            <RunScanButton
              auditDisabledReason={
                reposLoading
                  ? 'Still loading repositories…'
                  : auditReady
                    ? null
                    : 'Load repositories before auditing'
              }
              selectedRepoIds={selectedRepoIds.size > 0 ? [...selectedRepoIds] : undefined}
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

        <SummaryCards
          result={displayResult}
          isScanning={isScanning}
          inventoryLoading={reposLoading && inventory.length === 0}
        />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              All repositories
            </h2>
            {displayResult?.totalRepos ? (
              <span className="rounded-full border border-hairline bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {displayResult.totalRepos}
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
            selectedRepoIds={selectedRepoIds}
            onSelectionChange={setSelectedRepoIds}
          />
        </section>

      </div>
    </>
  );
}
