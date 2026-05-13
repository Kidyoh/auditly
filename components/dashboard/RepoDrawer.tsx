'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge, StatusBadge } from './SeverityBadge';
import {
  AlertTriangle,
  Package,
  FileWarning,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import type { RepoScanResult, VulnPackage } from '@/lib/types';

interface RepoDrawerProps {
  repo: RepoScanResult | null;
  open: boolean;
  onClose: () => void;
}

function PersistenceAlert({ paths }: Readonly<{ paths: string[] }>) {
  return (
    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
        <span className="text-sm font-semibold text-red-900">Persistence indicators</span>
      </div>
      <ul className="space-y-1">
        {paths.map((p) => (
          <li key={p}>
            <code className="text-xs text-red-900">{p}</code>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">
        These paths are often unrelated to dependency removal. Confirm intent and delete in source
        control if inappropriate.
      </p>
    </div>
  );
}

function VulnPackageCard({ pkg }: Readonly<{ pkg: VulnPackage }>) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{pkg.name}</span>
            <span className="text-muted-foreground text-xs">@{pkg.version}</span>
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              {pkg.ecosystem}
            </Badge>
            {pkg.isWatchlisted ? (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-800">
                Watchlist
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 truncate text-xs">{pkg.manifestFile}</p>
        </div>
        <SeverityBadge severity={pkg.severity} />
      </div>

      {pkg.vulnerabilities.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          {pkg.vulnerabilities.map((cve) => (
            <div key={cve.id} className="space-y-1 border-l-2 border-primary/30 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://osv.dev/vulnerability/${cve.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                >
                  {cve.id}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <SeverityBadge severity={cve.severity} />
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">{cve.summary}</p>
              {cve.aliases.length > 0 ? (
                <p className="font-mono text-[10px] text-muted-foreground">
                  Aliases: {cve.aliases.join(', ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {pkg.isWatchlisted && pkg.vulnerabilities.length === 0 && (
        <div className="border-l-2 border-red-300 pl-3">
          <p className="text-xs leading-relaxed text-red-800">
            Listed on internal watchlist for known malicious npm campaigns (e.g. typosquatting).
            Remove after verification.
          </p>
        </div>
      )}
    </div>
  );
}

function RepoDrawerHeaderStats({ repo }: Readonly<{ repo: RepoScanResult }>) {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" />
        <span>{repo.packages.length} total</span>
      </div>
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className={repo.vulnPackages.length > 0 ? 'font-medium text-orange-800' : ''}>
          {repo.vulnPackages.length} flagged
        </span>
      </div>
      {repo.persistenceFiles.length > 0 ? (
        <div className="flex items-center gap-1.5 font-medium text-red-700">
          <FileWarning className="h-3.5 w-3.5" />
          <span>{repo.persistenceFiles.length} persistence path(s)</span>
        </div>
      ) : null}
    </div>
  );
}

function RepoDrawerPackagesBody({ repo }: Readonly<{ repo: RepoScanResult }>) {
  if (repo.status === 'pending') {
    return (
      <p className="text-muted-foreground text-sm">
        Packages will appear here after an audit completes for this repository.
      </p>
    );
  }
  if (repo.packages.length === 0) {
    return <p className="text-muted-foreground text-sm">No manifest files found.</p>;
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {repo.packages.map((pkg, i) => {
        const isVuln = repo.vulnPackages.some(
          (v) => v.name === pkg.name && v.ecosystem === pkg.ecosystem,
        );
        return (
          <div
            key={`${pkg.ecosystem}:${pkg.name}:${i}`}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 ${isVuln ? 'bg-orange-50/80' : ''}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              {isVuln ? (
                <AlertTriangle className="text-orange-600 h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
              )}
              <span
                className={`truncate text-xs ${isVuln ? 'font-medium text-orange-950' : 'text-foreground'}`}
              >
                {pkg.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-muted-foreground text-[10px]">{pkg.version}</span>
              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                {pkg.ecosystem}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function repoDrawerAuditFooter(repo: RepoScanResult): string {
  if (repo.status === 'pending') {
    return 'Not audited yet';
  }
  if (repo.scannedAt) {
    return `Audited at ${new Date(repo.scannedAt).toLocaleString()}`;
  }
  return '';
}

export function RepoDrawer({ repo, open, onClose }: Readonly<RepoDrawerProps>) {
  if (!repo) return null;

  const persistencePaths = repo.persistenceFiles.map((f) => f.path);
  const isPendingRepo = repo.status === 'pending';
  const subtitle =
    `${repo.project}` +
    (isPendingRepo ? ' · awaiting audit' : ` · ${repo.packages.length} packages manifested`);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-lg leading-tight text-foreground">{repo.repoName}</SheetTitle>
              <SheetDescription className="mt-1 text-sm">{subtitle}</SheetDescription>
            </div>
            <StatusBadge status={repo.status} />
          </div>

          {isPendingRepo ? null : <RepoDrawerHeaderStats repo={repo} />}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-6 py-5">
            {isPendingRepo ? (
              <p className="text-muted-foreground rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
                Listed from Azure inventory only. Package and vulnerability detail appears after you run{' '}
                <strong className="text-foreground font-medium">Run audit</strong>.
              </p>
            ) : null}

            {persistencePaths.length > 0 ? <PersistenceAlert paths={persistencePaths} /> : null}

            {repo.vulnPackages.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                  Flagged packages ({repo.vulnPackages.length})
                </h3>
                <div className="space-y-3">
                  {repo.vulnPackages.map((pkg, i) => (
                    <VulnPackageCard key={`${pkg.ecosystem}:${pkg.name}:${i}`} pkg={pkg} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <Package className="h-3.5 w-3.5" />
                All packages ({repo.packages.length})
              </h3>
              <RepoDrawerPackagesBody repo={repo} />
            </section>

            {repo.status === 'error' && repo.errorMessage ? (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="font-mono text-xs text-red-700">{repo.errorMessage}</p>
              </div>
            ) : null}

            <p className="text-muted-foreground pb-2 text-[10px]">{repoDrawerAuditFooter(repo)}</p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
