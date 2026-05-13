import { NextRequest } from 'next/server';
import { runScan } from '@/lib/scanner';
import { store } from '@/lib/store';
import { requireAuthSession } from '@/lib/require-auth';
import type { ScanProgressEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServerCredentials(): { orgUrl: string; pat: string } | null {
  const orgUrl = process.env.AZURE_ORG_URL?.trim() ?? '';
  const pat = process.env.AZURE_PAT?.trim() ?? '';
  if (!orgUrl || !pat) return null;
  return { orgUrl, pat };
}

function sseMessage(event: ScanProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(_req: NextRequest) {
  const { error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  const creds = getServerCredentials();

  if (!creds) {
    return new Response(
      JSON.stringify({
        error:
          'Azure is not configured. Set AZURE_ORG_URL and AZURE_PAT in the server environment (.env.local).',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (store.isScanning) {
    return new Response(JSON.stringify({ error: 'A scan is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
        const result = await runScan(creds.orgUrl, creds.pat, send);
        store.lastResult = result;
      } catch (err) {
        if (err instanceof Error && err.message === 'SCAN_NO_PROJECTS') {
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
