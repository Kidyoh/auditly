import { NextRequest } from 'next/server';
import { runScan } from '@/lib/scanner';
import { store } from '@/lib/store';
import { requireAuthSession } from '@/lib/require-auth';
import type { ScanProgressEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sseMessage(event: ScanProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { accessToken, provider, error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'No access token. Please sign out and sign in again.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (store.isScanning) {
    return new Response(JSON.stringify({ error: 'A scan is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({})) as { repoIds?: string[] };
  const targetRepoIds = Array.isArray(body.repoIds) && body.repoIds.length > 0
    ? body.repoIds
    : undefined;

  store.isScanning = true;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScanProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(sseMessage(event)));
        } catch {
          /* client disconnected */
        }
      };

      try {
        const result = await runScan(accessToken, send, targetRepoIds, provider ?? 'github');
        store.lastResult = result;
      } catch (err) {
        if (err instanceof Error && err.message === 'SCAN_NO_REPOS') {
          /* SSE error already emitted by runScan */
        } else {
          send({
            type: 'error',
            message: err instanceof Error ? err.message : 'Scan failed',
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        store.isScanning = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
