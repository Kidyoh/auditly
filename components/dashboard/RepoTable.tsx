'use client';

import { useState, type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './SeverityBadge';
import { RepoDrawer } from './RepoDrawer';
import {
  AlertTriangle,
  Package,
  ShieldAlert,
  ChevronRight,
  Loader2,
  FolderGit2,
  CheckCircle2,
} from 'lucide-react';
import type { RepoScanResult, ScanResult } from '@/lib/types';

export interface RepoTableProps {
  result: ScanResult | null;
  isScanning: boolean;
  scanningRepo?: string;
  inventoryLoading?: boolean;
  inventoryError?: string | null;
  inventoryReady?: boolean;
}

function InventoryLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative">
        <span className="absolute inset-0 -m-2 rounded-full bg-primary/10 blur-md" aria-hidden />
        <Loader2 className="relative h-9 w-9 animate-spin text-primary" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">Discovering repositories</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Fetching every Git repo from Azure DevOps. This list stays visible before you run an audit.
      </p>
    </div>
  );
}

function InventoryErrorState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
        <AlertTriangle className="h-4 w-4 text-red-600" />
      </span>
      <p className="mt-3 text-sm font-medium text-destructive">Could not load repositories</p>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyInventoryState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted ring-1 ring-hairline">
        <FolderGit2 className="h-4 w-4 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">No repositories found</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Check your organization URL and PAT, then use{' '}
        <span className="font-medium text-foreground">Refresh inventory</span>.
      </p>
    </div>
  );
}

function RepoVulnerabilitiesCell({ repo }: Readonly<{ repo: RepoScanResult }>) {
  if (repo.status === 'pending') {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  if (repo.vulnPackages.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-xs text-muted-foreground">None</span>
      </div>
    );
  }

  const criticalVulns = repo.vulnPackages.filter((p) => p.severity === 'CRITICAL');
  const highVulns = repo.vulnPackages.filter((p) => p.severity === 'HIGH');
  const otherCount = repo.vulnPackages.length - criticalVulns.length - highVulns.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {criticalVulns.length > 0 && (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-[10px] font-semibold uppercase tracking-wide text-red-700"
        >
          {criticalVulns.length} critical
        </Badge>
      )}
      {highVulns.length > 0 && (
        <Badge
          variant="outline"
          className="border-orange-200 bg-orange-50 text-[10px] font-semibold uppercase tracking-wide text-orange-800"
        >
          {highVulns.length} high
        </Badge>
      )}
      {otherCount > 0 && (
        <Badge
          variant="outline"
          className="border-hairline bg-card text-[10px] font-medium text-muted-foreground"
        >
          +{otherCount}
        </Badge>
      )}
    </div>
  );
}

function RepoRow({
  repo,
  onClick,
  highlighted,
}: Readonly<{ repo: RepoScanResult; onClick: () => void; highlighted: boolean }>) {
  const isPending = repo.status === 'pending';

  return (
    <TableRow
      onClick={onClick}
      data-highlighted={highlighted || undefined}
      className="group cursor-pointer border-b border-hairline transition-colors hover:bg-primary/[0.025] data-[highlighted=true]:bg-primary/[0.04]"
    >
      <TableCell className="py-3.5 pl-5 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-hairline group-hover:bg-primary/10 group-hover:text-primary group-hover:ring-primary/20">
            <FolderGit2 className="h-3.5 w-3.5" />
          </span>
          <span className="truncate font-medium text-foreground">{repo.repoName}</span>
          {highlighted ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              auditing
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-3.5 text-sm text-muted-foreground">{repo.project}</TableCell>
      <TableCell className="py-3.5">
        {isPending ? (
          <span className="text-xs text-muted-foreground/60">—</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm tabular-nums text-foreground">{repo.packages.length}</span>
          </div>
        )}
      </TableCell>
      <TableCell className="py-3.5">
        <RepoVulnerabilitiesCell repo={repo} />
      </TableCell>
      <TableCell className="py-3.5">
        {repo.persistenceFiles.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
            <span className="text-xs font-medium text-red-700">
              {repo.persistenceFiles.length} file{repo.persistenceFiles.length === 1 ? '' : 's'}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell className="py-3.5">
        <StatusBadge status={repo.status} />
      </TableCell>
      <TableCell className="w-10 py-3.5 pr-5">
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
      </TableCell>
    </TableRow>
  );
}

export function RepoTable({
  result,
  isScanning,
  scanningRepo,
  inventoryLoading = false,
  inventoryError = null,
  inventoryReady = false,
}: Readonly<RepoTableProps>) {
  const [selectedRepo, setSelectedRepo] = useState<RepoScanResult | null>(null);

  const repos = result?.repos ?? [];

  const sorted = [...repos].sort((a, b) => {
    const order: Record<string, number> = {
      persistence_risk: 0,
      critical: 1,
      vulnerable: 2,
      error: 3,
      clean: 4,
      pending: 5,
    };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  let body: ReactNode;

  if (inventoryLoading && repos.length === 0) {
    body = <InventoryLoadingState />;
  } else if (inventoryError && repos.length === 0) {
    body = <InventoryErrorState message={inventoryError} />;
  } else if (repos.length === 0 && inventoryReady === false && !inventoryLoading && !isScanning) {
    body = <EmptyInventoryState />;
  } else if (repos.length === 0 && isScanning) {
    body = (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Preparing audit</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rows will populate from your Azure inventory as results stream in.
        </p>
      </div>
    );
  } else {
    body = (
      <Table>
        <TableHeader>
          <TableRow className="border-b border-hairline bg-surface-subtle/70 hover:bg-surface-subtle/70">
            <TableHead className="pl-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Repository
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Project
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Packages
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Vulnerabilities
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                Persistence
              </span>
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="w-10 pr-5" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((repo) => {
            const repoLabel = `${repo.project}/${repo.repoName}`;
            const highlighted = isScanning && scanningRepo === repoLabel;
            return (
              <RepoRow
                key={repo.repoId}
                repo={repo}
                highlighted={highlighted}
                onClick={() => setSelectedRepo(repo)}
              />
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <>
      <div className="surface-card overflow-hidden">
        {inventoryError && repos.length > 0 ? (
          <div className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 px-5 py-2.5 text-xs text-orange-950">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-700" />
            <span>
              Could not refresh repository list: {inventoryError}. Showing last known data below.
            </span>
          </div>
        ) : null}

        {isScanning && scanningRepo ? (
          <div className="flex items-center gap-2.5 border-b border-hairline bg-primary/[0.04] px-5 py-2.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">
              Auditing
              <span className="ml-1 text-muted-foreground">·</span>{' '}
              <span className="font-mono text-[11px] text-primary">{scanningRepo}</span>
            </span>
          </div>
        ) : null}

        {body}
      </div>

      <RepoDrawer repo={selectedRepo} open={!!selectedRepo} onClose={() => setSelectedRepo(null)} />
    </>
  );
}
