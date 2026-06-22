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
  GitCommitHorizontal,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import type { CVEDetail, FixChange, RepoScanResult, VulnPackage } from '@/lib/types';

// ─── types ────────────────────────────────────────────────────────────────────

interface RepoDrawerProps {
  repo: RepoScanResult | null;
  open: boolean;
  onClose: () => void;
}

type FixStatus = 'idle' | 'loading' | 'done' | 'error';

interface FixState {
  status: FixStatus;
  prUrl?: string;
  commitUrl?: string;
  changes?: FixChange[];
  errorMsg?: string;
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

  return (
    <div className={`rounded-lg border border-l-[3px] ${borderCls} ${bgCls} space-y-3 p-3.5`}>
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
      <p className="text-xs leading-relaxed text-foreground/90">{cve.summary}</p>
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

function VulnPackageCard({ pkg }: Readonly<{ pkg: VulnPackage }>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
        <SeverityBadge severity={pkg.severity} />
      </div>
      {pkg.vulnerabilities.length > 0 && (
        <div className="space-y-2.5 p-3.5">
          {pkg.vulnerabilities.map((cve) => (
            <CveCard key={cve.id} cve={cve} />
          ))}
        </div>
      )}
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

// ─── fix result panel ─────────────────────────────────────────────────────────

function FixResultPanel({
  fix,
  prLabel,
  onRetry,
}: Readonly<{
  fix: FixState;
  prLabel: string;
  onRetry: () => void;
}>) {
  if (fix.status === 'idle') return null;

  if (fix.status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Fetching latest versions and creating {prLabel}…
      </div>
    );
  }

  if (fix.status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-xs font-medium text-red-800">{fix.errorMsg ?? 'Fix failed.'}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1.5 text-[11px] text-red-600 underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
      {/* Links row */}
      <div className="flex flex-wrap gap-2">
        {fix.prUrl && (
          <a
            href={fix.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:bg-emerald-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View {prLabel}
          </a>
        )}
        {fix.commitUrl && (
          <a
            href={fix.commitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:bg-emerald-50"
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            View commit
          </a>
        )}
      </div>

      {/* Change table */}
      {fix.changes && fix.changes.length > 0 && (
        <div className="overflow-hidden rounded-md border border-emerald-200 bg-white">
          <div className="border-b border-emerald-100 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {fix.changes.length} package{fix.changes.length === 1 ? '' : 's'} bumped
            </span>
          </div>
          <ul className="divide-y divide-emerald-50">
            {fix.changes.map((c) => (
              <li key={`${c.name}:${c.manifestFile}`} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
                  {c.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground line-through">
                  {c.oldVersion}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 text-emerald-500" />
                <span className="shrink-0 font-mono text-[10px] font-semibold text-emerald-700">
                  {c.newVersion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── repo meta ────────────────────────────────────────────────────────────────

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
        <span className="ml-auto flex items-center gap-1.5">
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

  const vulnSet = new Set(repo.vulnPackages.map((v) => `${v.ecosystem}:${v.name}`));

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
              <span className={`truncate font-mono text-xs ${isVuln ? 'font-medium text-orange-900' : 'text-foreground'}`}>
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

// ─── main export ──────────────────────────────────────────────────────────────

export function RepoDrawer({ repo, open, onClose }: Readonly<RepoDrawerProps>) {
  const [fix, setFix] = useState<FixState>({ status: 'idle' });

  // Reset fix state when the drawer switches to a different repo
  const repoKey = repo ? `${repo.owner}/${repo.repoName}` : null;

  async function handleFixAll() {
    if (!repo) return;
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
          vulnPackages: repo.vulnPackages,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        prUrl?: string;
        commitUrl?: string;
        changes?: FixChange[];
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setFix({ status: 'error', errorMsg: data.message ?? 'Fix failed.' });
      } else {
        setFix({ status: 'done', prUrl: data.prUrl, commitUrl: data.commitUrl, changes: data.changes });
      }
    } catch {
      setFix({ status: 'error', errorMsg: 'Network error. Please try again.' });
    }
  }

  if (!repo) return null;

  const persistencePaths = repo.persistenceFiles.map((f) => f.path);
  const isPending = repo.status === 'pending';
  const pendingSource = repo.provider === 'gitlab' ? 'GitLab' : 'GitHub';
  const prLabel = repo.provider === 'gitlab' ? 'MR' : 'PR';
  const hasVulns = repo.vulnPackages.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setFix({ status: 'idle' });
        }
      }}
    >
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

            {/* Pending */}
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
            {persistencePaths.length > 0 && <PersistenceAlert paths={persistencePaths} />}

            {/* Vulnerabilities */}
            {hasVulns && (
              <section className="space-y-3">
                {/* Section header with Fix All button */}
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Vulnerable packages
                  </h3>
                  <span className="rounded-full border border-hairline bg-card px-2 py-0.5 text-[10px] font-medium text-foreground">
                    {repo.vulnPackages.length}
                  </span>
                  <div className="ml-auto">
                    {fix.status === 'idle' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 px-3 text-xs"
                        onClick={handleFixAll}
                        key={repoKey}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Fix all
                      </Button>
                    )}
                    {fix.status === 'loading' && (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 px-3 text-xs" disabled>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Fixing…
                      </Button>
                    )}
                    {(fix.status === 'done' || fix.status === 'error') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-muted-foreground"
                        onClick={() => setFix({ status: 'idle' })}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* Fix result */}
                <FixResultPanel
                  fix={fix}
                  prLabel={prLabel}
                  onRetry={() => setFix({ status: 'idle' })}
                />

                {/* Package cards */}
                <div className="space-y-4">
                  {repo.vulnPackages.map((pkg, i) => (
                    <VulnPackageCard key={`${pkg.ecosystem}:${pkg.name}:${i}`} pkg={pkg} />
                  ))}
                </div>
              </section>
            )}

            {/* Clean */}
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
