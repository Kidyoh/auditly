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
import { Button } from '@/components/ui/button';
import { SeverityBadge, StatusBadge } from './SeverityBadge';
import {
  AlertTriangle,
  Package,
  FileWarning,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Clock,
  Link2,
  Wrench,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import type { CVEDetail, RepoScanResult, VulnPackage } from '@/lib/types';

interface RepoDrawerProps {
  repo: RepoScanResult | null;
  open: boolean;
  onClose: () => void;
}

// ─── severity colour tokens ────────────────────────────────────────────────
const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-orange-400',
  MEDIUM: 'border-l-yellow-400',
  LOW: 'border-l-blue-400',
};
const SEVERITY_BG: Record<string, string> = {
  CRITICAL: 'bg-red-50/60',
  HIGH: 'bg-orange-50/60',
  MEDIUM: 'bg-yellow-50/40',
  LOW: 'bg-blue-50/40',
};

// ─── helpers ──────────────────────────────────────────────────────────────
function fmtDate(iso: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function aliasHref(alias: string): string | null {
  if (/^CVE-/i.test(alias)) return `https://nvd.nist.gov/vuln/detail/${alias}`;
  if (/^GHSA-/i.test(alias)) return `https://github.com/advisories/${alias}`;
  return null;
}

// ─── sub-components ───────────────────────────────────────────────────────
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        These paths are often unrelated to dependency removal. Confirm intent and delete in source
        control if inappropriate.
      </p>
    </div>
  );
}

function CveCard({ cve }: Readonly<{ cve: CVEDetail }>) {
  const borderCls = SEVERITY_BORDER[cve.severity] ?? 'border-l-border';
  const bgCls = SEVERITY_BG[cve.severity] ?? '';
  const publishedLabel = fmtDate(cve.published);
  const modifiedLabel = fmtDate(cve.modified);

  const osvHref = `https://osv.dev/vulnerability/${cve.id}`;
  const isGhsa = /^GHSA-/i.test(cve.id);
  const primaryHref = isGhsa ? `https://github.com/advisories/${cve.id}` : osvHref;
  const primaryLabel = isGhsa ? 'GitHub Advisory' : 'OSV.dev';

  return (
    <div
      className={`rounded-lg border border-l-[3px] ${borderCls} ${bgCls} space-y-3 p-3.5`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={primaryHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {cve.id}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          {isGhsa && (
            <a
              href={osvHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <Link2 className="h-3 w-3" />
              OSV
            </a>
          )}
          {cve.cvssScore !== undefined && (
            <span className="rounded border border-hairline bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
              CVSS&nbsp;{cve.cvssScore.toFixed(1)}
            </span>
          )}
        </div>
        <SeverityBadge severity={cve.severity} />
      </div>

      {/* Summary */}
      <p className="text-xs leading-relaxed text-foreground/90">{cve.summary}</p>

      {/* Aliases */}
      {cve.aliases.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">Also:</span>
          {cve.aliases.map((alias) => {
            const href = aliasHref(alias);
            return href ? (
              <a
                key={alias}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 rounded border border-hairline bg-card px-1.5 py-0.5 font-mono text-[10px] text-primary underline-offset-2 hover:underline"
              >
                {alias}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : (
              <span
                key={alias}
                className="rounded border border-hairline bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {alias}
              </span>
            );
          })}
        </div>
      )}

      {/* Dates */}
      {(publishedLabel || modifiedLabel) && (
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {publishedLabel && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Published {publishedLabel}
            </span>
          )}
          {modifiedLabel && modifiedLabel !== publishedLabel && (
            <span>Updated {modifiedLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── fix button state ─────────────────────────────────────────────────────
type FixStatus = 'idle' | 'loading' | 'done' | 'error';

interface FixState {
  status: FixStatus;
  prUrl?: string;
  newVersion?: string;
  errorMsg?: string;
}

interface VulnPackageCardProps {
  pkg: VulnPackage;
  repo: RepoScanResult;
}

function VulnPackageCard({ pkg, repo }: Readonly<VulnPackageCardProps>) {
  const [fix, setFix] = useState<FixState>({ status: 'idle' });

  async function handleFix() {
    setFix({ status: 'loading' });
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repo.owner,
          repoName: repo.repoName,
          branch: repo.defaultBranch,
          provider: repo.provider,
          projectId: repo.provider === 'gitlab' ? Number(repo.repoId) : null,
          pkg,
        }),
      });
      const data = (await res.json()) as { ok: boolean; prUrl?: string; newVersion?: string; message?: string };
      if (!res.ok || !data.ok) {
        setFix({ status: 'error', errorMsg: data.message ?? 'Fix failed' });
      } else {
        setFix({ status: 'done', prUrl: data.prUrl, newVersion: data.newVersion });
      }
    } catch {
      setFix({ status: 'error', errorMsg: 'Network error. Please try again.' });
    }
  }

  const prLabel = repo.provider === 'gitlab' ? 'MR' : 'PR';

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Package header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-surface-subtle/50 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{pkg.name}</span>
            <span className="text-xs text-muted-foreground">@{pkg.version}</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {pkg.ecosystem}
            </Badge>
            {pkg.isWatchlisted && (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] font-semibold text-red-800">
                Watchlist
              </Badge>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{pkg.manifestFile}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SeverityBadge severity={pkg.severity} />
          {/* Fix button / result */}
          {fix.status === 'idle' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={handleFix}
            >
              <Wrench className="h-3.5 w-3.5" />
              Fix
            </Button>
          )}
          {fix.status === 'loading' && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" disabled>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Fixing…
            </Button>
          )}
          {fix.status === 'done' && fix.prUrl && (
            <a
              href={fix.prUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              View {prLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {fix.status === 'error' && (
            <span
              title={fix.errorMsg}
              className="inline-flex h-7 cursor-default items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-800"
              onClick={() => setFix({ status: 'idle' })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setFix({ status: 'idle' })}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Failed — retry
            </span>
          )}
        </div>
      </div>

      {/* CVE list */}
      {pkg.vulnerabilities.length > 0 ? (
        <div className="space-y-2.5 p-3.5">
          {pkg.vulnerabilities.map((cve) => (
            <CveCard key={cve.id} cve={cve} />
          ))}
        </div>
      ) : null}

      {/* Watchlist-only explanation (no OSV hits) */}
      {pkg.isWatchlisted && pkg.vulnerabilities.length === 0 && (
        <div className="border-l-[3px] border-l-red-500 bg-red-50/50 p-3.5">
          <p className="text-xs leading-relaxed text-red-800">
            This package matches the internal watchlist for known malicious campaigns (e.g.
            typosquatting). No OSV entries found — verify and remove if unintentional.
          </p>
        </div>
      )}
    </div>
  );
}

function RepoMeta({ repo }: Readonly<{ repo: RepoScanResult }>) {
  const scannedLabel = repo.scannedAt ? fmtDate(repo.scannedAt) : null;
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5" />
        {repo.defaultBranch}
      </span>
      <span className="flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5" />
        {repo.packages.length} packages
      </span>
      {repo.vulnPackages.length > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-orange-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {repo.vulnPackages.length} flagged
        </span>
      )}
      {repo.persistenceFiles.length > 0 && (
        <span className="flex items-center gap-1.5 font-medium text-red-600">
          <FileWarning className="h-3.5 w-3.5" />
          {repo.persistenceFiles.length} persistence file{repo.persistenceFiles.length === 1 ? '' : 's'}
        </span>
      )}
      {scannedLabel && (
        <span className="flex items-center gap-1.5 ml-auto">
          <Clock className="h-3.5 w-3.5" />
          Scanned {scannedLabel}
        </span>
      )}
    </div>
  );
}

function AllPackagesList({ repo }: Readonly<{ repo: RepoScanResult }>) {
  if (repo.status === 'pending') {
    return (
      <p className="text-sm text-muted-foreground">
        Packages will appear here after an audit completes for this repository.
      </p>
    );
  }
  if (repo.packages.length === 0) {
    return <p className="text-sm text-muted-foreground">No manifest files found.</p>;
  }

  const vulnSet = new Set(
    repo.vulnPackages.map((v) => `${v.ecosystem}:${v.name}`),
  );

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {repo.packages.map((pkg, i) => {
        const isVuln = vulnSet.has(`${pkg.ecosystem}:${pkg.name}`);
        return (
          <div
            key={`${pkg.ecosystem}:${pkg.name}:${i}`}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 ${isVuln ? 'bg-orange-50/80' : ''}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              {isVuln ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-600" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
              )}
              <span
                className={`truncate font-mono text-xs ${isVuln ? 'font-medium text-orange-900' : 'text-foreground'}`}
              >
                {pkg.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{pkg.version}</span>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {pkg.ecosystem}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────
export function RepoDrawer({ repo, open, onClose }: Readonly<RepoDrawerProps>) {
  if (!repo) return null;

  const persistencePaths = repo.persistenceFiles.map((f) => f.path);
  const isPending = repo.status === 'pending';
  const pendingSource = repo.provider === 'gitlab' ? 'GitLab' : 'GitHub';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl lg:max-w-3xl">
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold leading-tight text-foreground">
                {repo.repoName}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
                {repo.owner}
                {isPending ? ' · awaiting audit' : ''}
              </SheetDescription>
            </div>
            <StatusBadge status={repo.status} />
          </div>
          {!isPending && <RepoMeta repo={repo} />}
        </SheetHeader>

        {/* Scrollable body */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-7 px-6 py-5">

            {/* Pending state */}
            {isPending && (
              <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Listed from {pendingSource} only. Package and vulnerability detail appears after you run{' '}
                <strong className="font-medium text-foreground">Run audit</strong>.
              </p>
            )}

            {/* Error */}
            {repo.status === 'error' && repo.errorMessage && (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="font-mono text-xs text-red-700">{repo.errorMessage}</p>
              </div>
            )}

            {/* Persistence */}
            {persistencePaths.length > 0 && (
              <PersistenceAlert paths={persistencePaths} />
            )}

            {/* Vulnerabilities */}
            {repo.vulnPackages.length > 0 && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                  Vulnerable packages
                  <span className="ml-auto rounded-full border border-hairline bg-card px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
                    {repo.vulnPackages.length}
                  </span>
                </h3>
                <div className="space-y-4">
                  {repo.vulnPackages.map((pkg, i) => (
                    <VulnPackageCard key={`${pkg.ecosystem}:${pkg.name}:${i}`} pkg={pkg} repo={repo} />
                  ))}
                </div>
              </section>
            )}

            {/* Clean result */}
            {!isPending && repo.status === 'clean' && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                No known vulnerabilities found in this repository.
              </div>
            )}

            {/* All packages */}
            {!isPending && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  All packages
                  <span className="ml-auto rounded-full border border-hairline bg-card px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
                    {repo.packages.length}
                  </span>
                </h3>
                <AllPackagesList repo={repo} />
              </section>
            )}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
