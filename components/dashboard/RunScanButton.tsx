'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Square, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ScanProgressEvent, ScanResult, RepoScanResult } from '@/lib/types';

interface RunScanButtonProps {
  auditDisabledReason?: string | null;
  selectedRepoIds?: string[];
  onScanAbort?: () => void;
  onScanUpdate: (repos: RepoScanResult[]) => void;
  onScanComplete: (result: ScanResult) => void;
  onScanStart: () => void;
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  setScanningRepo: (v: string) => void;
}

function parseSseScanEvent(line: string): ScanProgressEvent | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6)) as ScanProgressEvent;
  } catch {
    return null;
  }
}

type ScanStreamHandlers = Readonly<{
  setStatusMsg: (msg: string) => void;
  setProgress: (p: { current: number; total: number } | null) => void;
  setScanningRepo: (v: string) => void;
  setError: (msg: string) => void;
  onScanUpdate: (repos: RepoScanResult[]) => void;
  onScanComplete: (result: ScanResult) => void;
}>;

function applyScanProgressEvent(
  event: ScanProgressEvent,
  accRepos: RepoScanResult[],
  h: ScanStreamHandlers,
): void {
  h.setStatusMsg(event.message);

  if (event.progress !== undefined) h.setProgress(event.progress);

  if (event.type === 'repo_start' && event.repoName) {
    h.setScanningRepo(`${event.owner ?? ''}/${event.repoName}`);
  }

  if (event.type === 'repo_done' && event.result) {
    accRepos.push(event.result);
    h.onScanUpdate([...accRepos]);
  }

  if (event.type === 'complete' && event.scanResult) {
    h.onScanComplete(event.scanResult);
    h.setProgress(null);
    h.setScanningRepo('');
  }

  if (event.type === 'error') {
    h.setError(event.message);
  }
}

async function consumeScanSseBody(
  body: ReadableStream<Uint8Array>,
  handlers: ScanStreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const accRepos: RepoScanResult[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = parseSseScanEvent(line);
      if (!event) continue;
      applyScanProgressEvent(event, accRepos, handlers);
    }
  }
}

export function RunScanButton({
  auditDisabledReason,
  selectedRepoIds,
  onScanAbort,
  onScanUpdate,
  onScanComplete,
  onScanStart,
  isScanning,
  setIsScanning,
  setScanningRepo,
}: Readonly<RunScanButtonProps>) {
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const selectionCount = selectedRepoIds?.length ?? 0;

  const handleScan = useCallback(async () => {
    setError('');
    setStatusMsg('');
    setProgress(null);
    setIsScanning(true);
    onScanStart();

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const body = selectionCount > 0 ? JSON.stringify({ repoIds: selectedRepoIds }) : undefined;

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      await consumeScanSseBody(res.body, {
        setStatusMsg,
        setProgress,
        setScanningRepo,
        setError,
        onScanUpdate,
        onScanComplete,
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Scan failed');
      }
    } finally {
      setIsScanning(false);
      setScanningRepo('');
      abortRef.current = null;
    }
  }, [onScanUpdate, onScanComplete, onScanStart, setIsScanning, setScanningRepo, selectedRepoIds, selectionCount]);

  const auditBlocked = !!auditDisabledReason;

  function handleStop() {
    onScanAbort?.();
    abortRef.current?.abort();
    setIsScanning(false);
    setScanningRepo('');
    setStatusMsg('Stopped by user.');
    setProgress(null);
  }

  function handleAuditClick() {
    void handleScan();
  }

  const progressPct = progress ? Math.round((progress.current / progress.total) * 100) : 0;
  const buttonLabel = selectionCount > 0 ? `Audit ${selectionCount} repo${selectionCount === 1 ? '' : 's'}` : 'Run audit';

  return (
    <div className="space-y-3">
      {isScanning ? (
        <Button
          onClick={handleStop}
          variant="destructive"
          size="lg"
          className="w-full justify-center font-semibold"
        >
          <Square className="mr-2 h-3.5 w-3.5 fill-current" />
          Stop scan
        </Button>
      ) : (
        <Button
          onClick={handleAuditClick}
          disabled={auditBlocked}
          size="lg"
          title={auditBlocked ? (auditDisabledReason ?? undefined) : undefined}
          className="w-full justify-center bg-linear-to-b from-primary to-primary/90 font-semibold shadow-[0_8px_18px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)] ring-1 ring-primary/40 transition-shadow hover:from-primary hover:to-primary [a]:hover:bg-primary"
        >
          <Play className="mr-2 h-3.5 w-3.5 fill-current" />
          {buttonLabel}
        </Button>
      )}

      {isScanning && (
        <div className="space-y-2 rounded-lg border border-hairline bg-surface-subtle/70 p-3">
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
            <span className="truncate font-medium text-foreground">{statusMsg || 'Starting…'}</span>
          </div>
          {progress ? (
            <>
              <Progress value={progressPct} className="h-1.5" />
              <p className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {progress.current} / {progress.total} repos
                </span>
                <span className="font-medium tabular-nums text-foreground">{progressPct}%</span>
              </p>
            </>
          ) : null}
        </div>
      )}

      {!isScanning && statusMsg && !error ? (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {statusMsg}
        </p>
      ) : null}

      {auditBlocked && !isScanning && auditDisabledReason ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{auditDisabledReason}</p>
      ) : null}

      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
